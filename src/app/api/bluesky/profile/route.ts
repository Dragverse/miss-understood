import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * GET /api/bluesky/profile
 * Fetch full Bluesky profile data (avatar, banner, bio) for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({ error: "Not connected" });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (!session.bluesky) {
      return NextResponse.json(
        { error: "No Bluesky account connected" },
        { status: 401 }
      );
    }

    // Get Bluesky agent and fetch full profile
    const agent = await getBlueskyAgent();
    const profileData = await agent.getProfile({ actor: session.bluesky.handle });

    // Extract profile information
    const profile = {
      handle: profileData.data.handle,
      displayName: profileData.data.displayName || profileData.data.handle,
      avatar: profileData.data.avatar || null,
      banner: profileData.data.banner || null,
      description: profileData.data.description || null,
      followersCount: profileData.data.followersCount || 0,
      followsCount: profileData.data.followsCount || 0,
      postsCount: profileData.data.postsCount || 0,
      did: profileData.data.did,
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Bluesky profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
