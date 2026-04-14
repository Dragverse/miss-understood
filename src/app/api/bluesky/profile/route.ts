import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/profile
 * Fetch full Bluesky profile data (avatar, banner, bio) for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "No Bluesky account connected" },
        { status: 401 }
      );
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json(
        { error: "No Bluesky account connected" },
        { status: 401 }
      );
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json(
        { error: "Bluesky session expired. Please reconnect your Bluesky account." },
        { status: 401 }
      );
    }

    const profileData = await agent.getProfile({ actor: blueskyDID });

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

    return NextResponse.json({ success: true, profile });
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
