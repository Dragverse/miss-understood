import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/by-creator?creatorDID={did}
 * Fetches active streams for a specific creator
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creatorDID = searchParams.get("creatorDID");

    if (!creatorDID) {
      return NextResponse.json(
        { error: "creatorDID parameter is required" },
        { status: 400 }
      );
    }

    // Query Supabase for streams by this creator (not just active ones)
    // We'll check Livepeer API for actual live status
    const { data: streams, error } = await supabase
      .from("streams")
      .select("*")
      .eq("creator_did", creatorDID)
      .order("created_at", { ascending: false })
      .limit(10); // Get recent streams, not just active

    if (error) {
      console.error("Database query error:", error);

      // If table doesn't exist yet, return empty array instead of error
      if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
        console.warn("Streams table does not exist yet. Please run the database migration.");
        return NextResponse.json({
          streams: [],
          warning: "Database not migrated. Please run supabase-migration-streams.sql"
        });
      }

      return NextResponse.json(
        { error: "Failed to fetch streams" },
        { status: 500 }
      );
    }

    // Check Livepeer API for actual live status — parallel fetches
    const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;
    let activeStreams: any[] = [];

    if (streams && streams.length > 0 && LIVEPEER_API_KEY) {
      const results = await Promise.all(
        streams.map(async (stream) => {
          try {
            const livepeerResponse = await fetch(
              `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
              { headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` } }
            );
            if (!livepeerResponse.ok) {
              // Livepeer unreachable — fall back to DB status
              return stream.is_active ? stream : null;
            }
            const livepeerData = await livepeerResponse.json();

            // Sync DB if out of sync (fire-and-forget)
            if (livepeerData.isActive && !stream.is_active) {
              supabase.from("streams").update({ is_active: true, started_at: new Date().toISOString() }).eq("id", stream.id);
            } else if (!livepeerData.isActive && stream.is_active) {
              supabase.from("streams").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", stream.id);
            }

            return livepeerData.isActive ? stream : null;
          } catch {
            return stream.is_active ? stream : null;
          }
        })
      );

      activeStreams = results
        .filter(Boolean)
        .map((stream) => ({
          id: stream.id,                          // Supabase UUID (for status API)
          livepeerStreamId: stream.livepeer_stream_id,
          name: stream.title,
          isActive: true,
          playbackUrl: stream.playback_url,
          playbackId: stream.playback_id,
          startedAt: stream.started_at,
          peakViewers: stream.peak_viewers,
          totalViews: stream.total_views,
        }));
    }

    // Also return upcoming scheduled streams
    const now = new Date().toISOString();
    const upcomingStreams = (streams || [])
      .filter(s => s.scheduled_at && s.scheduled_at > now && !s.is_active)
      .map(s => ({
        id: s.id,                        // Supabase UUID
        livepeerStreamId: s.livepeer_stream_id,
        name: s.title,
        isActive: false,
        isScheduled: true,
        scheduledAt: s.scheduled_at,
        playbackUrl: s.playback_url,
        playbackId: s.playback_id,
      }));

    return NextResponse.json({
      streams: activeStreams,
      upcoming: upcomingStreams,
    });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
