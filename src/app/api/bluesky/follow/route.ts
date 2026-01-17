import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { getAuthenticatedAgent } from "@/lib/session/bluesky";

/**
 * POST /api/bluesky/follow
 * Follow or unfollow a user on Bluesky or store locally
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

    // If user has Bluesky connected, sync to Bluesky
    if (session.bluesky) {
      try {
        // Get authenticated Bluesky agent
        const { agent, error: authError } = await getAuthenticatedAgent(session.bluesky);

        if (!agent || authError) {
          console.error("Authentication error:", authError);
          // Fall through to local-only mode
        } else {
          if (action === "follow") {
            // Follow the user
            await agent.follow(did);
          } else {
            // Unfollow the user
            // First, get the follow record URI
            const follows = await agent.app.bsky.graph.getFollows({
              actor: session.bluesky.did!,
            });

            // Find the follow record for this user
            const followRecord = follows.data.follows.find(
              (f: any) => f.did === did
            );

            if (followRecord && followRecord.viewer?.following) {
              // Delete the follow record
              await agent.deleteFollow(followRecord.viewer.following);
            }
          }

          return NextResponse.json({
            success: true,
            action,
            synced: true,
          });
        }
      } catch (error) {
        console.error("Bluesky follow sync error:", error);
        // Fall through to local-only mode if Bluesky sync fails
      }
    }

    // Local-only mode: Return success so client can store in localStorage
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
