import { NextRequest, NextResponse } from "next/server";
import { fetchCuratedDragContent } from "@/lib/youtube/rss-client";

/**
 * GET /api/youtube/feed
 * Fetch drag content from curated YouTube channels via RSS (no API quota!)
 *
 * Query params:
 * - limit: number of videos to return (default: 20)
 * - sortBy: "engagement" | "recent" (default: "recent")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sortBy = searchParams.get("sortBy") || "recent";

    console.log(`[YouTube Feed API] Fetching ${limit} videos from RSS feeds...`);

    // Fetch drag content from curated YouTube channels (RSS - no quota limits!)
    const videos = await fetchCuratedDragContent(limit);

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
        source: "youtube-rss",
        warning: "No videos returned from RSS feeds - check server logs",
        message: "Using RSS feeds from curated drag channels (no API quota limits)",
      });
    }

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      source: "youtube-rss",
      message: "Videos fetched from RSS feeds (no API quota limits)",
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
