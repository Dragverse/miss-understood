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

    // Query Supabase for active streams by this creator
    const { data: streams, error } = await supabase
      .from("streams")
      .select("*")
      .eq("creator_did", creatorDID)
      .eq("is_active", true)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch streams" },
        { status: 500 }
      );
    }

    // Transform database records to API format
    const formattedStreams = (streams || []).map((stream) => ({
      id: stream.livepeer_stream_id,
      name: stream.title,
      isActive: stream.is_active,
      playbackUrl: stream.playback_url,
      playbackId: stream.playback_id,
      startedAt: stream.started_at,
      peakViewers: stream.peak_viewers,
      totalViews: stream.total_views,
    }));

    return NextResponse.json({
      streams: formattedStreams,
    });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
