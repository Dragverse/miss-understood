import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAgent } from "@/lib/session/bluesky";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

/**
 * API route to like/unlike a post on Bluesky
 * POST /api/bluesky/like
 * Body: { postUri: string, postCid: string, action: "like" | "unlike" }
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

    if (action !== "like" && action !== "unlike") {
      return NextResponse.json(
        { error: "action must be 'like' or 'unlike'" },
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

    if (action === "like") {
      // Like the post
      const response = await blueskyAgent.like(postUri, postCid);

      return NextResponse.json({
        success: true,
        action: "liked",
        likeUri: response.uri,
      });
    } else {
      // Unlike the post - need to find the like record first
      // Get the user's likes to find the like URI
      const likes = await blueskyAgent.app.bsky.feed.getActorLikes({
        actor: session.bluesky.did!,
        limit: 100,
      });

      const likeRecord = likes.data.feed.find(
        (item: any) => item.post.uri === postUri
      );

      if (likeRecord && likeRecord.post.viewer?.like) {
        await blueskyAgent.deleteLike(likeRecord.post.viewer.like);

        return NextResponse.json({
          success: true,
          action: "unliked",
        });
      } else {
        return NextResponse.json(
          { error: "Like record not found" },
          { status: 404 }
        );
      }
    }
  } catch (error) {
    console.error("Bluesky like/unlike error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to like/unlike post",
      },
      { status: 500 }
    );
  }
}
