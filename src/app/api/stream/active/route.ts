import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isHLSManifestLive(playbackId: string): Promise<boolean> {
  try {
    const url = `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return (
      text.length > 50 &&
      (text.includes(".ts") ||
        text.includes(".m4s") ||
        text.includes("#EXTINF") ||
        text.includes("#EXT-X-MEDIA-SEQUENCE"))
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/stream/active
 * Returns all currently active streams with creator profile info.
 * Used by the homepage LiveNowSection.
 */
export async function GET() {
  try {
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
          avatar
        )
      `)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(12);

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

    // Verify each stream is actually live (Livepeer API → HLS fallback)
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
              isLive = true; // API unavailable — trust DB is_active
            }
          } catch {
            isLive = true; // Error — trust DB
          }
        } else {
          isLive = true; // No API key — trust DB
        }

        // If Livepeer says inactive, verify with HLS manifest before excluding
        if (!isLive && stream.playback_id) {
          isLive = await isHLSManifestLive(stream.playback_id);
        }

        if (!isLive) return null;

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
        };
      })
    );

    return NextResponse.json({ streams: verified.filter(Boolean) });
  } catch (err) {
    console.error("[stream/active] Error:", err);
    return NextResponse.json({ streams: [] });
  }
}
