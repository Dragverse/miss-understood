import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isHLSManifestLive } from "@/lib/stream/hls";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/live?handle={handle}
 *
 * Resolves handle → creator_did, then checks for an active stream using the
 * same 3-layer detection (Livepeer API → HLS manifest → DB is_active) as
 * /api/stream/by-creator.
 *
 * Returns { stream, creator } for the /live/[handle] page.
 * Stream may be null if the creator is not currently live.
 */
export async function GET(request: NextRequest) {
  try {
    const handle = request.nextUrl.searchParams.get("handle");
    if (!handle) {
      return NextResponse.json({ error: "handle parameter is required" }, { status: 400 });
    }

    // Resolve handle → creator row
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("did, handle, display_name, avatar, verified, description, follower_count, following_count")
      .eq("handle", handle)
      .maybeSingle();

    if (creatorError) {
      console.error("[stream/live] Creator lookup error:", creatorError);
      return NextResponse.json({ error: "Failed to look up creator" }, { status: 500 });
    }

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Look up recent/active streams for this creator
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: streams, error: streamsError } = await supabase
      .from("streams")
      .select("*")
      .eq("creator_did", creator.did)
      .or(`is_active.eq.true,created_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (streamsError) {
      if (
        streamsError.message?.includes("relation") &&
        streamsError.message?.includes("does not exist")
      ) {
        return NextResponse.json({ stream: null, creator: normalizeCreator(creator) });
      }
      console.error("[stream/live] Streams lookup error:", streamsError);
      return NextResponse.json({ stream: null, creator: normalizeCreator(creator) });
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json({ stream: null, creator: normalizeCreator(creator) });
    }

    const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

    // 3-layer detection for each candidate stream
    const results = await Promise.all(
      streams.map(async (stream) => {
        let isLive = false;

        if (LIVEPEER_API_KEY && stream.livepeer_stream_id) {
          try {
            const res = await fetch(
              `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
              {
                headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
                cache: "no-store",
              }
            );
            if (res.ok) {
              const data = await res.json();
              isLive = data.isActive ?? false;
            } else {
              isLive = stream.is_active;
            }
          } catch {
            isLive = stream.is_active;
          }
        } else {
          isLive = stream.is_active;
        }

        if (!isLive && stream.playback_id) {
          isLive = await isHLSManifestLive(stream.playback_id);
        }
        if (!isLive) {
          isLive = stream.is_active;
        }

        // Self-heal DB
        if (isLive && !stream.is_active) {
          void supabase
            .from("streams")
            .update({ is_active: true, started_at: stream.started_at ?? new Date().toISOString() })
            .eq("id", stream.id);
        } else if (!isLive && stream.is_active) {
          void supabase
            .from("streams")
            .update({ is_active: false })
            .eq("id", stream.id);
        }

        if (!isLive) return null;

        return {
          id: stream.id,
          livepeerStreamId: stream.livepeer_stream_id,
          title: stream.title || "Live Stream",
          playbackId: stream.playback_id,
          playbackUrl: `https://livepeercdn.studio/hls/${stream.playback_id}/index.m3u8`,
          startedAt: stream.started_at,
          peakViewers: stream.peak_viewers ?? 0,
          totalViews: stream.total_views ?? 0,
        };
      })
    );

    const activeStream = results.find(Boolean) ?? null;

    return NextResponse.json({
      stream: activeStream,
      creator: normalizeCreator(creator),
    });
  } catch (err) {
    console.error("[stream/live] Error:", err);
    return NextResponse.json({ stream: null, creator: null }, { status: 500 });
  }
}

function normalizeCreator(c: {
  did: string;
  handle: string;
  display_name: string | null;
  avatar: string | null;
  verified: boolean | null;
  description: string | null;
  follower_count: number | null;
  following_count: number | null;
}) {
  return {
    did: c.did,
    handle: c.handle,
    displayName: c.display_name ?? c.handle,
    avatar: c.avatar ?? "/defaultpfp.png",
    verified: c.verified ?? false,
    bio: c.description ?? "",
    followerCount: c.follower_count ?? 0,
    followingCount: c.following_count ?? 0,
  };
}
