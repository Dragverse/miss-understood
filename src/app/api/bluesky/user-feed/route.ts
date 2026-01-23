import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { getAuthenticatedAgent } from "@/lib/session/bluesky";
import { blueskyPostToContent } from "@/lib/bluesky/client";

/**
 * Fetch the authenticated user's own Bluesky posts
 * @route GET /api/bluesky/user-feed?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get session
    const response = new NextResponse();
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky) {
      return NextResponse.json({
        success: false,
        error: "No Bluesky account connected",
        posts: [],
      });
    }

    // Get authenticated agent
    const { agent, error } = await getAuthenticatedAgent(session.bluesky);

    if (error || !agent) {
      return NextResponse.json({
        success: false,
        error: error || "Failed to authenticate with Bluesky",
        posts: [],
      });
    }

    // Resolve handle to DID
    const profile = await agent.getProfile({ actor: session.bluesky.handle });
    const userDID = profile.data.did;

    // Fetch user's posts using getAuthorFeed
    const feed = await agent.getAuthorFeed({
      actor: userDID,
      limit: limit,
    });

    // Transform PostView to BlueskyPost format
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

    // Transform to content format
    const transformedPosts = posts
      .map(blueskyPostToContent)
      .filter((post) => post !== null);

    console.log(`[UserFeed] Loaded ${transformedPosts.length} posts for ${session.bluesky.handle}`);

    return NextResponse.json({
      success: true,
      posts: transformedPosts,
      count: transformedPosts.length,
      handle: session.bluesky.handle,
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
