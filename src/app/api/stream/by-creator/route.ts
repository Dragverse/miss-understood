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

    // Check Livepeer API for actual live status of each stream
    const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;
    const activeStreams = [];

    if (streams && streams.length > 0 && LIVEPEER_API_KEY) {
      for (const stream of streams) {
        try {
          // Query Livepeer API for stream status
          const livepeerResponse = await fetch(
            `https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`,
            {
              headers: {
                Authorization: `Bearer ${LIVEPEER_API_KEY}`,
              },
            }
          );

          if (livepeerResponse.ok) {
            const livepeerData = await livepeerResponse.json();

            // Stream is active if Livepeer reports it as active
            if (livepeerData.isActive) {
              activeStreams.push({
                id: stream.livepeer_stream_id,
                name: stream.title,
                isActive: true, // Use Livepeer's status, not database
                playbackUrl: stream.playback_url,
                playbackId: stream.playback_id,
                startedAt: stream.started_at,
                peakViewers: stream.peak_viewers,
                totalViews: stream.total_views,
              });

              // Update database if it's out of sync
              if (!stream.is_active) {
                console.log(`📡 Syncing stream ${stream.id} to active state`);
                await supabase
                  .from("streams")
                  .update({
                    is_active: true,
                    started_at: new Date().toISOString()
                  })
                  .eq("id", stream.id);
              }
            } else if (stream.is_active) {
              // Stream is no longer active, update database
              console.log(`📡 Syncing stream ${stream.id} to inactive state`);
              await supabase
                .from("streams")
                .update({
                  is_active: false,
                  ended_at: new Date().toISOString()
                })
                .eq("id", stream.id);
            }
          }
        } catch (err) {
          console.error(`Failed to check stream ${stream.livepeer_stream_id}:`, err);
          // Fallback to database status if Livepeer check fails
          if (stream.is_active) {
            activeStreams.push({
              id: stream.livepeer_stream_id,
              name: stream.title,
              isActive: stream.is_active,
              playbackUrl: stream.playback_url,
              playbackId: stream.playback_id,
              startedAt: stream.started_at,
              peakViewers: stream.peak_viewers,
              totalViews: stream.total_views,
            });
          }
        }
      }
    }

    return NextResponse.json({
      streams: activeStreams,
    });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
