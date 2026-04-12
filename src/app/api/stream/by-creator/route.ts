import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Check HLS manifest for live segments — same fallback as the official stream route */
async function isHLSManifestLive(playbackId: string): Promise<boolean> {
  try {
    const url = `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return false;
    const text = await res.text();
    const hasContent =
      text.length > 50 &&
      (text.includes(".ts") ||
        text.includes(".m4s") ||
        text.includes("#EXTINF") ||
        text.includes("#EXT-X-MEDIA-SEQUENCE"));
    return hasContent;
  } catch {
    return false;
  }
}

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

    const { data: streams, error } = await supabase
      .from("streams")
      .select("*")
      .eq("creator_did", creatorDID)
      .order("created_at", { ascending: false })
      .limit(10);

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

        // 1. Ask Livepeer API
        if (LIVEPEER_API_KEY) {
          try {
            const res = await fetch(
              `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
              { headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` } }
            );
            if (res.ok) {
              const data = await res.json();
              isLive = data.isActive ?? false;

              // Sync DB (fire-and-forget)
              if (isLive && !stream.is_active) {
                supabase.from("streams").update({ is_active: true, started_at: new Date().toISOString() }).eq("id", stream.id);
              } else if (!isLive && stream.is_active) {
                // Before marking inactive, verify with HLS manifest
                isLive = await isHLSManifestLive(stream.playback_id);
                if (!isLive) {
                  supabase.from("streams").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", stream.id);
                }
              }
            } else {
              // Livepeer API unavailable — fall back to DB
              isLive = stream.is_active;
            }
          } catch {
            isLive = stream.is_active;
          }
        } else {
          // No API key — try HLS manifest directly
          isLive = stream.is_active || await isHLSManifestLive(stream.playback_id);
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
