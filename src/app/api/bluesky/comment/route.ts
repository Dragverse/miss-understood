import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { getBlueskyAgent } from "@/lib/bluesky/client";
import { getAuthenticatedAgent } from "@/lib/session/bluesky";
import { RichText } from "@atproto/api";

/**
 * POST /api/bluesky/comment
 * Post a comment (reply) to a Bluesky post or store locally
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ error: "Not connected" });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    const body = await request.json();
    const { postUri, postCid, text } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 }
      );
    }

    // If user has Bluesky connected AND post has URI/CID, sync to Bluesky
    if (session.bluesky && postUri && postCid) {
      try {
        // Get authenticated Bluesky agent
        const { agent, error: authError } = await getAuthenticatedAgent(session.bluesky);

        if (!agent || authError) {
          console.error("Authentication error:", authError);
          // Fall through to local-only mode
        } else {
          // Create rich text with facets (links, mentions, hashtags)
          const rt = new RichText({ text });
          await rt.detectFacets(agent);

          // Post the reply
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
        }
      } catch (error) {
        console.error("Bluesky comment sync error:", error);
        // Fall through to local-only mode if Bluesky sync fails
      }
    }

    // Local-only mode: Store comment locally (for Dragverse-only users)
    // Return success so client can store in localStorage
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

    // Get the thread (includes replies)
    const thread = await agent.getPostThread({ uri: postUri });

    // Extract replies - check if thread is a ThreadViewPost (has replies property)
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
