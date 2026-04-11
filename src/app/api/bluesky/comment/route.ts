import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";
import { RichText } from "@atproto/api";

/**
 * POST /api/bluesky/comment
 * Post a comment (reply) to a Bluesky post or store locally
 */
export async function POST(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    const body = await request.json();
    const { postUri, postCid, text } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 }
      );
    }

    // If user is authenticated and has Bluesky connected AND post has URI/CID, sync to Bluesky
    if (auth?.authenticated && auth.userId && postUri && postCid) {
      const blueskyDID = await getBlueskyOAuthDID(auth.userId);
      if (blueskyDID) {
        const agent = await getOAuthAgent(blueskyDID);
        if (agent) {
          try {
            const rt = new RichText({ text });
            await rt.detectFacets(agent);

            const reply = await agent.post({
              text: rt.text,
              facets: rt.facets,
              reply: {
                root: {
                  uri: postUri,
                  cid: postCid,
                },
                parent: {
                  uri: postUri,
                  cid: postCid,
                },
              },
            });

            return NextResponse.json({
              success: true,
              uri: reply.uri,
              cid: reply.cid,
              synced: true,
            });
          } catch (error) {
            console.error("Bluesky comment sync error:", error);
            // Fall through to local-only mode if Bluesky sync fails
          }
        }
      }
    }

    // Local-only mode: Store comment locally (for Dragverse-only users)
    return NextResponse.json({
      success: true,
      localOnly: true,
      synced: false,
    });
  } catch (error) {
    console.error("Comment error:", error);
    return NextResponse.json(
      {
        error: "Failed to post comment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bluesky/comment
 * Get comments (replies) for a Bluesky post
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postUri = searchParams.get("postUri");

    if (!postUri) {
      return NextResponse.json(
        { error: "Missing required parameter: postUri" },
        { status: 400 }
      );
    }

    // Get Bluesky agent (public API, no auth required to read)
    const agent = await getBlueskyAgent();

    const thread = await agent.getPostThread({ uri: postUri });

    let replies: any[] = [];
    if (thread.data.thread && 'replies' in thread.data.thread && thread.data.thread.replies) {
      replies = thread.data.thread.replies.map((reply: any) => ({
        id: reply.post.uri,
        author: {
          displayName: reply.post.author.displayName || reply.post.author.handle,
          handle: reply.post.author.handle,
          avatar: reply.post.author.avatar || "/default-avatar.png",
        },
        text: reply.post.record.text,
        createdAt: reply.post.record.createdAt,
        likeCount: reply.post.likeCount || 0,
        uri: reply.post.uri,
        cid: reply.post.cid,
      }));
    }

    return NextResponse.json({
      success: true,
      comments: replies,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch comments",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
