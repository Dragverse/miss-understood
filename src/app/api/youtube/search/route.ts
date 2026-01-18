import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeVideos } from "@/lib/youtube/client";

/**
 * GET /api/youtube/search
 * Search YouTube videos by keyword
 *
 * Query params:
 * - q: search query (required)
 * - limit: number of videos to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Search query is required" },
        { status: 400 }
      );
    }

    // Search YouTube
    const videos = await searchYouTubeVideos(query, limit);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      query,
    });
  } catch (error) {
    console.error("Failed to search YouTube:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search YouTube",
        videos: [],
      },
      { status: 500 }
    );
  }
}
