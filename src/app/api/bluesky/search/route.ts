import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent, blueskyPostToVideo, sortPostsByEngagement } from "@/lib/bluesky/client";

/**
 * API route to search Bluesky posts by hashtag
 * GET /api/bluesky/search?q=%23DragRace&limit=30
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const agent = await getBlueskyAgent();

    // Search for posts
    const searchResults = await agent.app.bsky.feed.searchPosts({
      q: query,
      limit: Math.min(limit, 100), // Bluesky API limit
    });

    if (!searchResults.data.posts || searchResults.data.posts.length === 0) {
      return NextResponse.json({
        success: true,
        posts: [],
        count: 0,
        query,
      });
    }

    // Convert Bluesky posts to our format
    const posts = searchResults.data.posts
      .map((item: any) => ({
        uri: item.uri,
        cid: item.cid,
        author: {
          did: item.author.did,
          handle: item.author.handle,
          displayName: item.author.displayName,
          avatar: item.author.avatar,
        },
        text: item.record.text || "",
        createdAt: item.record.createdAt || item.indexedAt,
        embed: item.embed
          ? {
              type: item.embed.$type,
              video: item.embed.video,
              external: item.embed.external,
              images: item.embed.images,
            }
          : undefined,
        likeCount: item.likeCount || 0,
        replyCount: item.replyCount || 0,
        repostCount: item.repostCount || 0,
      }))
      .map(blueskyPostToVideo)
      .filter((post) => post !== null);

    // Sort by engagement
    const sortedPosts = sortPostsByEngagement(posts);

    return NextResponse.json({
      success: true,
      posts: sortedPosts,
      count: sortedPosts.length,
      query,
    });
  } catch (error) {
    console.error("Bluesky search error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search posts",
        posts: [],
      },
      { status: 500 }
    );
  }
}
