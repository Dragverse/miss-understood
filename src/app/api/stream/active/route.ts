import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isHLSManifestLive } from "@/lib/stream/hls";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/active
 * Returns all currently active streams with creator profile info.
 * Used by the homepage LiveNowSection.
 *
 * Truth order for each candidate: Livepeer API → HLS manifest → DB is_active
 * Query: is_active=true OR created_at within last 4 hours
 *   This catches streams where updateStreamStatus() silently failed so is_active
 *   was never written, but the stream is genuinely live on Livepeer.
 */
export async function GET() {
  try {
    // Include streams that are marked active OR were recently created (may not
    // have had is_active=true written yet if the status PUT failed).
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const { data: streams, error } = await supabase
      .from("streams")
      .select(`
        id,
        livepeer_stream_id,
        title,
        playback_id,
        is_active,
        started_at,
        peak_viewers,
        total_views,
        creator_did,
        profiles:creators!creator_did (
          handle,
          display_name,
          avatar,
          banner
        )
      `)
      .or(`is_active.eq.true,created_at.gte.${since}`)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(20); // Slightly higher limit since some won't pass liveness check

    if (error) {
      if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
        return NextResponse.json({ streams: [] });
      }
      console.error("[stream/active] Supabase error:", error);
      return NextResponse.json({ streams: [] });
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json({ streams: [] });
    }

    const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

    // Verify each stream is actually live (Livepeer API → HLS fallback → DB)
    const verified = await Promise.all(
      streams.map(async (stream) => {
        let isLive = false;

        if (LIVEPEER_API_KEY && stream.livepeer_stream_id) {
          try {
            const res = await fetch(
              `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
              { headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` }, cache: "no-store" }
            );
            if (res.ok) {
              const data = await res.json();
              isLive = data.isActive ?? false;
            } else {
              // Livepeer API unavailable — trust DB
              isLive = stream.is_active;
            }
          } catch {
            isLive = stream.is_active;
          }
        } else {
          isLive = stream.is_active;
        }

        // If Livepeer says inactive, check HLS manifest before discarding
        if (!isLive && stream.playback_id) {
          isLive = await isHLSManifestLive(stream.playback_id);
        }

        if (!isLive) return null;

        // Self-heal: mark active in DB so future queries find it immediately
        if (!stream.is_active) {
          void supabase
            .from("streams")
            .update({ is_active: true, started_at: new Date().toISOString() })
            .eq("id", stream.id);
        }

        const profile = Array.isArray(stream.profiles) ? stream.profiles[0] : stream.profiles;

        return {
          id: stream.id,
          livepeerStreamId: stream.livepeer_stream_id,
          title: stream.title || "Live Stream",
          playbackId: stream.playback_id,
          playbackUrl: `https://livepeercdn.studio/hls/${stream.playback_id}/index.m3u8`,
          startedAt: stream.started_at,
          peakViewers: stream.peak_viewers ?? 0,
          totalViews: stream.total_views ?? 0,
          creatorDID: stream.creator_did,
          creatorHandle: profile?.handle ?? null,
          creatorName: profile?.display_name ?? "Creator",
          creatorAvatar: profile?.avatar ?? null,
          creatorBanner: profile?.banner ?? null,
        };
      })
    );

    const live = verified.filter(Boolean);

    return NextResponse.json({ streams: live });
  } catch (err) {
    console.error("[stream/active] Error:", err);
    return NextResponse.json({ streams: [] });
  }
}
