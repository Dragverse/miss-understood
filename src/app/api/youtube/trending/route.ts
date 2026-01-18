import { NextRequest, NextResponse } from "next/server";
import { getTrendingVideos } from "@/lib/youtube/client";

/**
 * GET /api/youtube/trending
 * Get trending YouTube videos
 *
 * Query params:
 * - region: region code (default: "US")
 * - limit: number of videos to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "US";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Fetch trending videos
    const videos = await getTrendingVideos(region, limit);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      region,
    });
  } catch (error) {
    console.error("Failed to fetch trending YouTube videos:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trending videos",
        videos: [],
      },
      { status: 500 }
    );
  }
}
