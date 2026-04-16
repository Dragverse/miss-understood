import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";
import { blueskyPostToContent } from "@/lib/bluesky/client";

/**
 * Fetch the authenticated user's own Bluesky posts
 * @route GET /api/bluesky/user-feed?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
        posts: [],
      });
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json({
        success: false,
        error: "No Bluesky account connected",
        posts: [],
      });
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: "Bluesky session expired. Reconnect in Settings.",
        posts: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const profile = await agent.getProfile({ actor: blueskyDID });
    const handle = profile.data.handle;

    const feed = await agent.getAuthorFeed({
      actor: blueskyDID,
      limit: limit,
    });

    const posts = feed.data.feed.map((item: any) => ({
      uri: item.post.uri,
      cid: item.post.cid,
      author: {
        did: item.post.author.did,
        handle: item.post.author.handle,
        displayName: item.post.author.displayName,
        avatar: item.post.author.avatar,
      },
      text: item.post.record.text || "",
      createdAt: item.post.record.createdAt || item.post.indexedAt,
      embed: item.post.embed
        ? {
            type: item.post.embed.$type,
            video: item.post.embed.video,
            external: item.post.embed.external,
            images: item.post.embed.images,
          }
        : undefined,
      likeCount: item.post.likeCount || 0,
      replyCount: item.post.replyCount || 0,
      repostCount: item.post.repostCount || 0,
    }));

    const transformedPosts = posts
      .map(post => blueskyPostToContent(post))
      .filter((post) => post !== null);

    console.log(`[UserFeed] Loaded ${transformedPosts.length} posts for ${handle}`);

    return NextResponse.json({
      success: true,
      posts: transformedPosts,
      count: transformedPosts.length,
      handle,
    });
  } catch (error) {
    console.error("[UserFeed] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user feed",
        posts: [],
      },
      { status: 500 }
    );
  }
}
