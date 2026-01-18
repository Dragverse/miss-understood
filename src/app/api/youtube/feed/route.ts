import { NextRequest, NextResponse } from "next/server";
import { searchDragContent } from "@/lib/youtube/client";

/**
 * GET /api/youtube/feed
 * Fetch drag content from curated YouTube channels
 *
 * Query params:
 * - limit: number of videos to return (default: 20)
 * - sortBy: "engagement" | "recent" (default: "engagement")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sortBy = searchParams.get("sortBy") || "engagement";

    console.log(`[YouTube Feed API] Fetching ${limit} videos...`);

    // Fetch drag content from YouTube
    const videos = await searchDragContent(limit);

    console.log(`[YouTube Feed API] Returned ${videos.length} videos`);

    // Sort by recent if requested
    if (sortBy === "recent") {
      videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // If no videos, return diagnostic info
    if (videos.length === 0) {
      return NextResponse.json({
        success: true,
        videos: [],
        count: 0,
        source: "youtube",
        warning: "No videos returned - check server logs for [YouTube] messages",
        apiKeyConfigured: !!process.env.YOUTUBE_API_KEY,
      });
    }

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      source: "youtube",
    });
  } catch (error) {
    console.error("[YouTube Feed API] Exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch YouTube feed",
        details: error instanceof Error ? error.message : String(error),
        videos: [],
      },
      { status: 500 }
    );
  }
}
