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

    // Fetch drag content from YouTube
    const videos = await searchDragContent(limit);

    // Sort by recent if requested
    if (sortBy === "recent") {
      videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      source: "youtube",
    });
  } catch (error) {
    console.error("Failed to fetch YouTube feed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch YouTube feed",
        videos: [],
      },
      { status: 500 }
    );
  }
}
