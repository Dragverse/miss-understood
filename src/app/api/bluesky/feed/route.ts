import { NextRequest, NextResponse } from "next/server";
import {
  searchDragContent,
  getDragAccountsPosts,
  blueskyPostToVideo,
  blueskyPostToContent,
  sortPostsByEngagement,
} from "@/lib/bluesky/client";
import { getValidDragAccountHandles } from "@/lib/bluesky/drag-accounts";
import { calculateQualityScore } from "@/lib/curation/quality-score";

/**
 * API route to fetch drag-related content from Bluesky
 * GET /api/bluesky/feed?limit=50&contentType=all|videos
 *
 * Query params:
 * - limit: number of items to return (default: 50)
 * - contentType: "all" (videos, images, text) or "videos" (default: "videos")
 * - source: "search" or "accounts" (default: "search")
 * - sortBy: "engagement" or "recent" (default: "engagement")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const source = searchParams.get("source") || "accounts"; // Default to "accounts" for curated drag creators
    const sortBy = searchParams.get("sortBy") as "engagement" | "recent" || "engagement";
    const contentType = searchParams.get("contentType") || "videos"; // "all" or "videos"

    let posts;

    if (source === "accounts") {
      // Fetch from curated drag-related accounts (filtered for valid handles only)
      const dragAccounts = getValidDragAccountHandles();
      console.log(`[Bluesky API] Fetching from ${dragAccounts.length} curated drag accounts`);
      posts = await getDragAccountsPosts(dragAccounts, limit);
    } else {
      // Search by hashtags (fallback)
      console.log("[Bluesky API] Searching by hashtags");
      posts = await searchDragContent(limit);
    }

    // Sort posts by engagement or recency
    posts = sortPostsByEngagement(posts, sortBy);

    // Convert posts based on content type
    let videos;
    if (contentType === "all") {
      // Include videos, images, and text posts
      videos = posts
        .map(blueskyPostToContent)
        .filter((video) => video !== null);
    } else {
      // Only videos (default behavior)
      videos = posts
        .map(blueskyPostToVideo)
        .filter((video) => video !== null);
    }

    // Debug logging
    console.log(`[Bluesky API] Found ${posts.length} posts, converted to ${videos.length} items (contentType: ${contentType})`);
    if (posts.length > 0 && videos.length === 0) {
      console.log("[Bluesky API] Sample post embeds:", posts.slice(0, 3).map(p => ({
        text: p.text.substring(0, 50),
        hasEmbed: !!p.embed,
        embedType: p.embed?.type,
        hasVideo: !!p.embed?.video,
        hasExternal: !!p.embed?.external,
        hasImages: !!p.embed?.images
      })));
    }

    // Apply quality filtering (score >= 40 for external content)
    const videosWithScores = videos.map(video => ({
      ...video,
      qualityScore: calculateQualityScore(video).overallScore,
    }));

    const qualityFiltered = videosWithScores.filter(v => v.qualityScore >= 40);

    console.log(`[Bluesky API] Quality filtering: ${videos.length} → ${qualityFiltered.length} items (threshold: 40)`);

    videos = qualityFiltered;

    return NextResponse.json({
      success: true,
      posts: videos, // Pages expect "posts" field
      videos, // Keep both for compatibility
      count: videos.length,
      totalPosts: posts.length, // For debugging
      source: "bluesky",
      sortedBy: sortBy,
    });
  } catch (error) {
    console.error("[Bluesky Feed API] Error:", error);

    // Return 401 for auth errors, not 500
    if (error instanceof Error && error.message.includes("authentication")) {
      return NextResponse.json(
        {
          error: "Bluesky authentication failed. Check credentials.",
          videos: [],
          posts: [],
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch feed",
        videos: [],
        posts: [],
      },
      { status: 500 }
    );
  }
}
