import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * GET /api/search
 * Unified search across Dragverse (Ceramic) and Bluesky
 * Searches for users, posts, and hashtags
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const type = searchParams.get("type") || "all"; // all, users, posts, hashtags

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const results = {
      users: [] as any[],
      posts: [] as any[],
      hashtags: [] as any[],
    };

    // Search Bluesky
    try {
      const agent = await getBlueskyAgent();

      // Search for users on Bluesky
      if (type === "all" || type === "users") {
        const actorSearch = await agent.searchActors({
          term: query,
          limit: 10,
        });

        results.users = actorSearch.data.actors.map((actor: any) => ({
          did: actor.did,
          handle: actor.handle,
          displayName: actor.displayName || actor.handle,
          avatar: actor.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${actor.handle}`,
          description: actor.description || "",
          followerCount: actor.followersCount || 0,
          source: "bluesky",
        }));
      }

      // Search for posts on Bluesky
      if (type === "all" || type === "posts") {
        const postSearch = await agent.app.bsky.feed.searchPosts({
          q: query,
          limit: 20,
        });

        results.posts = postSearch.data.posts.map((post: any) => ({
          id: post.uri,
          text: post.record.text,
          author: {
            did: post.author.did,
            handle: post.author.handle,
            displayName: post.author.displayName || post.author.handle,
            avatar: post.author.avatar,
          },
          createdAt: post.record.createdAt,
          likeCount: post.likeCount || 0,
          replyCount: post.replyCount || 0,
          source: "bluesky",
          externalUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
        }));
      }

      // Extract hashtags from Bluesky posts
      if (type === "all" || type === "hashtags") {
        const hashtagMatches = new Set<string>();
        results.posts.forEach((post: any) => {
          const matches = post.text.match(/#\w+/g);
          if (matches) {
            matches.forEach((tag: string) => hashtagMatches.add(tag.toLowerCase()));
          }
        });

        results.hashtags = Array.from(hashtagMatches).map((tag) => ({
          tag,
          source: "bluesky",
          postCount: results.posts.filter((p: any) =>
            p.text.toLowerCase().includes(tag)
          ).length,
        }));
      }
    } catch (blueskyError) {
      console.error("Bluesky search error:", blueskyError);
      // Continue even if Bluesky search fails
    }

    // TODO: Search Dragverse (Ceramic) data
    // Add Ceramic search results to results.users, results.posts, results.hashtags

    return NextResponse.json({
      success: true,
      query,
      results,
      totalResults:
        results.users.length + results.posts.length + results.hashtags.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
