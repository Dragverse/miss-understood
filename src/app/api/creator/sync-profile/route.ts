import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getCreatorByDID, createOrUpdateCreator } from "@/lib/supabase/creators";
import {
  getPrivyUserProfile,
  extractDisplayName,
  extractHandle,
  extractAvatar,
  extractSocialHandles,
} from "@/lib/privy/server";

/**
 * POST /api/creator/sync-profile
 * Sync creator profile with latest data from Privy
 * Updates existing creator record with real Twitter/Google/etc profile data
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { error: "Privy not configured" },
        { status: 500 }
      );
    }

    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userDID = auth.userId;
    console.log("[Sync Profile] Syncing profile for user:", userDID);

    // Fetch full user profile from Privy
    const privyUser = await getPrivyUserProfile(userDID);
    if (!privyUser) {
      return NextResponse.json(
        { error: "Failed to fetch user profile from Privy" },
        { status: 500 }
      );
    }

    console.log("[Sync Profile] Fetched Privy user profile");

    // Extract profile data
    const creatorData = {
      did: userDID,
      handle: extractHandle(privyUser, userDID),
      display_name: extractDisplayName(privyUser),
      avatar: extractAvatar(privyUser, userDID),
      description: "", // Keep existing description
      ...extractSocialHandles(privyUser),
    };

    console.log("[Sync Profile] Updating creator with data:", {
      handle: creatorData.handle,
      display_name: creatorData.display_name,
      avatar: creatorData.avatar,
    });

    // Update or create creator (upsert will update if exists)
    const creator = await createOrUpdateCreator(creatorData);

    console.log("[Sync Profile] ✅ Creator profile synced:", creator.id);

    return NextResponse.json({
      success: true,
      message: "Profile synced successfully",
      creator: {
        id: creator.id,
        handle: creator.handle,
        displayName: creator.display_name,
        avatar: creator.avatar,
      },
    });
  } catch (error) {
    console.error("[Sync Profile] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync profile",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
