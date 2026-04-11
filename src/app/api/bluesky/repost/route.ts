import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * API route to repost/unrepost a post on Bluesky
 * POST /api/bluesky/repost
 * Body: { postUri: string, postCid: string, action: "repost" | "unrepost" }
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

    if (action !== "repost" && action !== "unrepost") {
      return NextResponse.json(
        { error: "action must be 'repost' or 'unrepost'" },
        { status: 400 }
      );
    }

    if (action === "repost") {
      const response = await agent.repost(postUri, postCid);
      return NextResponse.json({
        success: true,
        action: "reposted",
        repostUri: response.uri,
      });
    } else {
      const feed = await agent.getAuthorFeed({
        actor: blueskyDID,
        filter: "posts_with_replies",
        limit: 100,
      });

      const repostRecord = feed.data.feed.find(
        (item: any) =>
          item.reason?.$type === "app.bsky.feed.defs#reasonRepost" &&
          item.post.uri === postUri
      );

      if (repostRecord && repostRecord.post.viewer?.repost) {
        await agent.deleteRepost(repostRecord.post.viewer.repost);
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
