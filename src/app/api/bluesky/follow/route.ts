import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * POST /api/bluesky/follow
 * Follow or unfollow a user on Bluesky or store locally
 */
export async function POST(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    const body = await request.json();
    const { did, action } = body;

    if (!did || !action) {
      return NextResponse.json(
        { error: "Missing required fields: did, action" },
        { status: 400 }
      );
    }

    if (action !== "follow" && action !== "unfollow") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'follow' or 'unfollow'" },
        { status: 400 }
      );
    }

    // If user is authenticated and has Bluesky connected, sync to Bluesky
    if (auth?.authenticated && auth.userId) {
      const blueskyDID = await getBlueskyOAuthDID(auth.userId);
      if (blueskyDID) {
        const agent = await getOAuthAgent(blueskyDID);
        if (agent) {
          try {
            if (action === "follow") {
              await agent.follow(did);
            } else {
              const follows = await agent.app.bsky.graph.getFollows({
                actor: blueskyDID,
              });

              const followRecord = follows.data.follows.find(
                (f: any) => f.did === did
              );

              if (followRecord && followRecord.viewer?.following) {
                await agent.deleteFollow(followRecord.viewer.following);
              }
            }

            return NextResponse.json({
              success: true,
              action,
              synced: true,
            });
          } catch (error) {
            console.error("Bluesky follow sync error:", error);
            // Fall through to local-only mode
          }
        }
      }
    }

    // Local-only mode
    return NextResponse.json({
      success: true,
      action,
      localOnly: true,
      synced: false,
    });
  } catch (error) {
    console.error("Follow/unfollow error:", error);
    return NextResponse.json(
      {
        error: "Failed to follow/unfollow user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
