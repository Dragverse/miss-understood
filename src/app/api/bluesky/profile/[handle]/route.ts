import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * API route to fetch any public Bluesky profile by handle
 * GET /api/bluesky/profile/[handle]
 *
 * This allows fetching external Bluesky profiles for display in Dragverse
 * Example: /api/bluesky/profile/rupaulsdragrace.bsky.social
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const { handle } = params;

    if (!handle) {
      return NextResponse.json(
        { error: "Handle is required" },
        { status: 400 }
      );
    }

    // Get Bluesky agent (can fetch public profiles without authentication)
    const agent = await getBlueskyAgent();

    // Fetch the public profile
    const profileResponse = await agent.getProfile({ actor: handle });

    if (!profileResponse.success) {
      return NextResponse.json(
        { error: "Profile not found or is private" },
        { status: 404 }
      );
    }

    // Extract and return profile data
    const profile = {
      handle: profileResponse.data.handle,
      displayName: profileResponse.data.displayName || profileResponse.data.handle,
      avatar: profileResponse.data.avatar || null,
      banner: profileResponse.data.banner || null,
      description: profileResponse.data.description || null,
      followersCount: profileResponse.data.followersCount || 0,
      followsCount: profileResponse.data.followsCount || 0,
      postsCount: profileResponse.data.postsCount || 0,
      did: profileResponse.data.did,
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Failed to fetch Bluesky profile:", error);

    // Check if it's a "profile not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Profile not found",
          message: "This Bluesky profile does not exist or is private",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch Bluesky profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
