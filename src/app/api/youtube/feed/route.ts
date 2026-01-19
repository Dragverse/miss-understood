import { NextRequest, NextResponse } from "next/server";
import { searchDragContent } from "@/lib/youtube/client";
import { fetchCuratedDragContent } from "@/lib/youtube/rss-client";
import type { Video } from "@/types";

/**
 * GET /api/youtube/feed
 * Fetch drag content from YouTube
 * - Tries YouTube Data API first (if YOUTUBE_API_KEY is set)
 * - Falls back to RSS feeds if API fails
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

    console.log(`[YouTube Feed API] Fetching ${limit} videos...`);

    let videos: Video[] = [];
    let source = "unknown";

    // Try YouTube Data API first (more reliable, has engagement data)
    if (process.env.YOUTUBE_API_KEY) {
      console.log("[YouTube Feed API] Attempting YouTube Data API...");
      try {
        videos = await searchDragContent(limit);
        source = "youtube-api";
        console.log(`[YouTube Feed API] ✅ Got ${videos.length} videos from YouTube Data API`);
      } catch (apiError) {
        console.warn("[YouTube Feed API] API failed, falling back to RSS:", apiError);
        videos = [];
      }
    }

    // Fallback to RSS if API didn't work
    if (videos.length === 0) {
      console.log("[YouTube Feed API] Trying RSS feeds as fallback...");
      videos = await fetchCuratedDragContent(limit);
      source = "youtube-rss";
      console.log(`[YouTube Feed API] ${videos.length > 0 ? '✅' : '⚠️'} Got ${videos.length} videos from RSS`);
    }

    // Sort by recent if requested
    if (sortBy === "recent") {
      videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // If still no videos, return diagnostic info
    if (videos.length === 0) {
      return NextResponse.json({
        success: true,
        videos: [],
        count: 0,
        source,
        warning: "No videos returned from YouTube - check server logs",
        message: source === "youtube-api"
          ? "YouTube Data API returned no results"
          : "RSS feeds returned no results (may be blocked or channels have no recent content)",
      });
    }

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      source,
      message: source === "youtube-api"
        ? "Videos fetched from YouTube Data API"
        : "Videos fetched from RSS feeds",
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
