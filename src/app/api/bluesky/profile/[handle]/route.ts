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
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    console.log(`[Bluesky Profile API] Fetching profile for handle: ${handle}`);

    if (!handle) {
      return NextResponse.json(
        { error: "Handle is required" },
        { status: 400 }
      );
    }

    // Get Bluesky agent (can fetch public profiles without authentication)
    const agent = await getBlueskyAgent();
    console.log(`[Bluesky Profile API] Agent created, fetching profile for ${handle}...`);

    // Fetch the public profile
    const profileResponse = await agent.getProfile({ actor: handle });
    console.log(`[Bluesky Profile API] Profile response success:`, profileResponse.success);

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
    console.error(`[Bluesky Profile API] Exception fetching profile for ${await params.then(p => p.handle)}:`, error);

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
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
