import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isHLSManifestLive } from "@/lib/stream/hls";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/by-creator?creatorDID={did}
 * Returns active streams for a creator.
 * Truth order: Livepeer API → HLS manifest → Supabase is_active
 */
export async function GET(request: NextRequest) {
  try {
    const creatorDID = request.nextUrl.searchParams.get("creatorDID");
    if (!creatorDID) {
      return NextResponse.json(
        { error: "creatorDID parameter is required" },
        { status: 400 }
      );
    }

    // Only consider streams from the last 24 hours OR marked active.
    // This avoids doing HLS manifest checks on months of old dead streams.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: streams, error } = await supabase
      .from("streams")
      .select("*")
      .eq("creator_did", creatorDID)
      .or(`is_active.eq.true,created_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
        return NextResponse.json({ streams: [], upcoming: [] });
      }
      return NextResponse.json({ error: "Failed to fetch streams" }, { status: 500 });
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json({ streams: [], upcoming: [] });
    }

    const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

    const results = await Promise.all(
      streams.map(async (stream) => {
        let isLive = false;
        // Track whether Livepeer gave a definitive answer so we never override
        // a "not active" response with a stale DB is_active=true.
        let livepeerDefinitive = false;

        // 1. Ask Livepeer API
        if (LIVEPEER_API_KEY && stream.livepeer_stream_id) {
          try {
            const res = await fetch(
              `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
              { headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` }, cache: "no-store" }
            );
            if (res.ok) {
              const data = await res.json();
              isLive = data.isActive ?? false;
              livepeerDefinitive = true; // Livepeer answered authoritatively
            } else {
              // Livepeer API unavailable — fall back to DB
              isLive = stream.is_active;
            }
          } catch {
            isLive = stream.is_active;
          }
        } else {
          isLive = stream.is_active;
        }

        // 2. HLS manifest check (only when not yet confirmed live)
        if (!isLive && stream.playback_id) {
          isLive = await isHLSManifestLive(stream.playback_id);
        }

        // 3. DB fallback ONLY when Livepeer didn't give a definitive answer.
        // Never let a stale is_active=true override a "not active" from Livepeer.
        if (!isLive && !livepeerDefinitive) {
          isLive = stream.is_active;
        }

        // Self-heal the DB — fire-and-forget so every profile visit corrects stale is_active
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
          name: stream.title,
          isActive: true,
          playbackId: stream.playback_id,
          playbackUrl: `https://livepeercdn.studio/hls/${stream.playback_id}/index.m3u8`,
          startedAt: stream.started_at,
          peakViewers: stream.peak_viewers,
          totalViews: stream.total_views,
        };
      })
    );

    const activeStreams = results.filter(Boolean);

    const now = new Date().toISOString();
    const upcomingStreams = streams
      .filter((s) => s.scheduled_at && s.scheduled_at > now && !s.is_active)
      .map((s) => ({
        id: s.id,
        livepeerStreamId: s.livepeer_stream_id,
        name: s.title,
        isActive: false,
        isScheduled: true,
        scheduledAt: s.scheduled_at,
        playbackId: s.playback_id,
        playbackUrl: `https://livepeercdn.studio/hls/${s.playback_id}/index.m3u8`,
      }));

    return NextResponse.json({ streams: activeStreams, upcoming: upcomingStreams });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
