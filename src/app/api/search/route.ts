import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";
import { searchCreators } from "@/lib/supabase/creators";

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

    // Search Dragverse (Ceramic) data
    if (type === "all" || type === "users") {
      try {
        console.log("[Search API] Searching Dragverse for:", query);
        const dragverseUsers = await searchCreators(query, 20);
        console.log("[Search API] Dragverse results:", dragverseUsers.length, "users found");

        const dragverseUsersMapped = dragverseUsers.map((creator: any) => ({
          did: creator.id,
          handle: creator.handle,
          displayName: creator.displayName || creator.handle,
          avatar: creator.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${creator.handle}`,
          description: creator.description || "",
          followerCount: creator.followerCount || 0,
          source: "dragverse",
        }));

        // Merge duplicate users by handle
        const userMap = new Map<string, any>();

        // Add Dragverse users first
        dragverseUsersMapped.forEach((user: any) => {
          userMap.set(user.handle.toLowerCase(), {
            ...user,
            sources: ["dragverse"],
            dragverseFollowerCount: user.followerCount,
            followerCount: user.followerCount,
          });
        });

        // Merge or add Bluesky users
        results.users.forEach((user: any) => {
          const existing = userMap.get(user.handle.toLowerCase());
          if (existing) {
            // User exists on both platforms - merge
            existing.sources.push("bluesky");
            existing.blueskyFollowerCount = user.followerCount;
            existing.followerCount = (existing.dragverseFollowerCount || 0) + user.followerCount;
            // Keep Dragverse data as primary, but update if Bluesky has better info
            if (!existing.avatar || existing.avatar.includes("dicebear")) {
              existing.avatar = user.avatar;
            }
          } else {
            // Bluesky-only user
            userMap.set(user.handle.toLowerCase(), {
              ...user,
              sources: ["bluesky"],
              blueskyFollowerCount: user.followerCount,
            });
          }
        });

        // Replace results.users with merged users
        results.users = Array.from(userMap.values()).slice(0, 10);
        console.log("[Search API] Final merged results:", results.users.length, "users");
      } catch (ceramicError) {
        console.error("[Search API] Ceramic search error:", ceramicError);
        // Continue even if Ceramic search fails - keep Bluesky results
      }
    }

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
