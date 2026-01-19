import { NextRequest, NextResponse } from "next/server";
import { searchDragContent } from "@/lib/youtube/client";
import { fetchCuratedDragContent, fetchCuratedShorts } from "@/lib/youtube/rss-client";
import { getCachedVideos, setCachedVideos } from "@/lib/youtube/cache";
import type { Video } from "@/types";

/**
 * GET /api/youtube/feed
 * Fetch drag content from YouTube with aggressive caching
 * - Cache duration: 1 hour (reduces API quota usage by ~10x)
 * - Tries YouTube Data API first (if YOUTUBE_API_KEY is set AND rssOnly is not true)
 * - Falls back to RSS feeds if API fails or if rssOnly is true
 *
 * Query params:
 * - limit: number of videos to return (default: 20)
 * - sortBy: "engagement" | "recent" (default: "recent")
 * - shortsOnly: "true" | "false" (default: "false") - only return YouTube Shorts
 * - rssOnly: "true" | "false" (default: "false") - force RSS-only, skip API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sortBy = searchParams.get("sortBy") || "recent";
    const shortsOnly = searchParams.get("shortsOnly") === "true";
    const rssOnly = searchParams.get("rssOnly") === "true";

    console.log(`[YouTube Feed API] Fetching ${limit} ${shortsOnly ? 'shorts' : 'videos'}...`);

    // Create cache key based on limit and shorts filter
    const cacheKey = shortsOnly ? `youtube-shorts-${limit}` : `youtube-feed-${limit}`;

    // Check cache first (saves API quota!)
    const cachedVideos = getCachedVideos(cacheKey);
    if (cachedVideos) {
      console.log(`[YouTube Feed API] ✅ Returning ${cachedVideos.length} cached ${shortsOnly ? 'shorts' : 'videos'} (saved API quota!)`);
      return NextResponse.json({
        success: true,
        videos: sortBy === "recent"
          ? cachedVideos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          : cachedVideos,
        count: cachedVideos.length,
        source: "cache",
        message: "Videos served from cache (1 hour TTL)",
      });
    }

    let videos: Video[] = [];
    let source = "unknown";

    // If shortsOnly, use RSS-only approach (no API needed for shorts detection)
    if (shortsOnly) {
      console.log("[YouTube Feed API] Fetching YouTube Shorts via RSS feeds...");
      videos = await fetchCuratedShorts(limit);
      source = "youtube-rss-shorts";
      console.log(`[YouTube Feed API] ${videos.length > 0 ? '✅' : '⚠️'} Got ${videos.length} shorts from RSS`);
    } else {
      // Try YouTube Data API first (more reliable, has engagement data)
      // BUT skip API if rssOnly is true
      if (process.env.YOUTUBE_API_KEY && !rssOnly) {
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

      // Fallback to RSS if API didn't work OR if rssOnly is true
      if (videos.length === 0 || rssOnly) {
        console.log(`[YouTube Feed API] ${rssOnly ? 'RSS-only mode requested,' : ''} Trying RSS feeds${rssOnly ? '' : ' as fallback'}...`);
        videos = await fetchCuratedDragContent(limit);
        source = "youtube-rss";
        console.log(`[YouTube Feed API] ${videos.length > 0 ? '✅' : '⚠️'} Got ${videos.length} videos from RSS`);
      }
    }

    // Cache successful results (even empty arrays, to avoid repeated failed API calls)
    if (videos.length > 0) {
      setCachedVideos(cacheKey, videos);
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
