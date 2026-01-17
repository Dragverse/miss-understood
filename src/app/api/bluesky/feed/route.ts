import { NextRequest, NextResponse } from "next/server";
import {
  searchDragContent,
  getDragAccountsPosts,
  blueskyPostToVideo,
} from "@/lib/bluesky/client";

/**
 * API route to fetch drag-related content from Bluesky
 * GET /api/bluesky/feed?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const source = searchParams.get("source") || "search"; // "search" or "accounts"

    let posts;

    if (source === "accounts") {
      // Fetch from specific drag-related accounts (you can customize this list)
      const dragAccounts = [
        "rupaulsdragrace.bsky.social",
        "drag.bsky.social",
        "dragqueen.bsky.social",
        "queendom.bsky.social",
        "lgbtq.bsky.social",
        // Add more known drag-related Bluesky handles here
      ];
      posts = await getDragAccountsPosts(dragAccounts, limit);
    } else {
      // Search by hashtags
      posts = await searchDragContent(limit);
    }

    // Convert posts to video format (filter out non-video posts)
    const videos = posts
      .map(blueskyPostToVideo)
      .filter((video) => video !== null);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      source: "bluesky",
    });
  } catch (error) {
    console.error("Bluesky feed fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch feed",
        videos: [],
      },
      { status: 500 }
    );
  }
}
