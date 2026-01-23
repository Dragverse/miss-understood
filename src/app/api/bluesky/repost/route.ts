import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAgent } from "@/lib/session/bluesky";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

/**
 * API route to repost/unrepost a post on Bluesky
 * POST /api/bluesky/repost
 * Body: { postUri: string, postCid: string, action: "repost" | "unrepost" }
 */
export async function POST(request: NextRequest) {
  try {
    const response = new Response();
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky) {
      return NextResponse.json(
        { error: "Not connected to Bluesky" },
        { status: 401 }
      );
    }

    const { postUri, postCid, action } = await request.json();

    if (!postUri || !postCid) {
      return NextResponse.json(
        { error: "postUri and postCid are required" },
        { status: 400 }
      );
    }

    if (action !== "repost" && action !== "unrepost") {
      return NextResponse.json(
        { error: "action must be 'repost' or 'unrepost'" },
        { status: 400 }
      );
    }

    // Create authenticated agent with user's session
    const { agent: blueskyAgent, error: authError } = await getAuthenticatedAgent(session.bluesky);

    if (!blueskyAgent || authError) {
      return NextResponse.json(
        { error: authError || "Failed to authenticate with Bluesky" },
        { status: 401 }
      );
    }

    if (action === "repost") {
      // Repost the post
      const response = await blueskyAgent.repost(postUri, postCid);

      return NextResponse.json({
        success: true,
        action: "reposted",
        repostUri: response.uri,
      });
    } else {
      // Unrepost - need to find the repost record first
      // Get the user's reposts to find the repost URI
      const feed = await blueskyAgent.getAuthorFeed({
        actor: session.bluesky.did!,
        filter: "posts_with_replies",
        limit: 100,
      });

      // Find the repost record
      const repostRecord = feed.data.feed.find(
        (item: any) =>
          item.reason?.$type === "app.bsky.feed.defs#reasonRepost" &&
          item.post.uri === postUri
      );

      if (repostRecord && repostRecord.post.viewer?.repost) {
        await blueskyAgent.deleteRepost(repostRecord.post.viewer.repost);

        return NextResponse.json({
          success: true,
          action: "unreposted",
        });
      } else {
        return NextResponse.json(
          { error: "Repost record not found" },
          { status: 404 }
        );
      }
    }
  } catch (error) {
    console.error("Bluesky repost/unrepost error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to repost/unrepost post",
      },
      { status: 500 }
    );
  }
}
