import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * API route to like/unlike a post on Bluesky
 * POST /api/bluesky/like
 * Body: { postUri: string, postCid: string, action: "like" | "unlike" }
 */
export async function POST(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json(
        { error: "Bluesky not connected" },
        { status: 401 }
      );
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json(
        { error: "Bluesky session expired. Reconnect in Settings." },
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

    if (action === "like") {
      const response = await agent.like(postUri, postCid);
      return NextResponse.json({
        success: true,
        action: "liked",
        likeUri: response.uri,
      });
    } else {
      const likes = await agent.app.bsky.feed.getActorLikes({
        actor: blueskyDID,
        limit: 100,
      });

      const likeRecord = likes.data.feed.find(
        (item: any) => item.post.uri === postUri
      );

      if (likeRecord && likeRecord.post.viewer?.like) {
        await agent.deleteLike(likeRecord.post.viewer.like);
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
