import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getCreatorByDID, createOrUpdateCreator } from "@/lib/supabase/creators";
import {
  getPrivyUserProfile,
  extractDisplayName,
  extractHandle,
  extractAvatar,
  extractSocialHandles,
  extractBlueskyFromSession,
} from "@/lib/privy/server";

/**
 * POST /api/creator/sync-profile
 * Sync creator profile with latest data from Privy + Bluesky + YouTube
 * Updates existing creator record with real social profile data
 *
 * Priority for handle/display_name:
 * 1. Bluesky (if connected)
 * 2. YouTube (if connected)
 * 3. Twitter/Google from Privy
 * 4. Generic fallback
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

    // Check if user already has a profile with custom uploads
    const existingCreator = await getCreatorByDID(userDID);

    // Extract Bluesky session data (if user has connected Bluesky)
    const blueskyData = await extractBlueskyFromSession(request);

    // Extract profile data with priority system
    const socialHandles = extractSocialHandles(privyUser);

    // Priority: Bluesky > Twitter > Others
    let finalHandle = extractHandle(privyUser, userDID);
    let finalDisplayName = extractDisplayName(privyUser);
    let finalAvatar = extractAvatar(privyUser, userDID);

    if (blueskyData) {
      console.log("[Sync Profile] Using Bluesky profile data (priority #1)");
      finalHandle = blueskyData.handle;
      finalDisplayName = blueskyData.displayName || finalDisplayName;
      finalAvatar = blueskyData.avatar || finalAvatar;
    }

    // IMPORTANT: Preserve user-uploaded custom content
    // Only sync avatar/banner if user hasn't uploaded custom ones
    const hasCustomAvatar = existingCreator?.avatar &&
      !existingCreator.avatar.includes("defaultpfp") &&
      !existingCreator.avatar.includes("dicebear") &&
      existingCreator.avatar.includes("livepeer"); // Custom uploads use Livepeer IPFS

    const hasCustomBanner = existingCreator?.banner &&
      existingCreator.banner.includes("livepeer"); // Custom uploads use Livepeer IPFS

    const creatorData = {
      did: userDID,
      handle: finalHandle,
      display_name: finalDisplayName,
      avatar: hasCustomAvatar ? existingCreator.avatar : finalAvatar, // Preserve custom avatar
      banner: hasCustomBanner ? existingCreator.banner : undefined, // Preserve custom banner
      description: existingCreator?.description || "", // Keep existing description
      ...socialHandles,
      ...(blueskyData && {
        bluesky_handle: blueskyData.handle,
        bluesky_did: blueskyData.did || "",
      }),
    };

    console.log("[Sync Profile] Updating creator with data:", {
      handle: creatorData.handle,
      display_name: creatorData.display_name,
      avatar: creatorData.avatar,
      bluesky_handle: creatorData.bluesky_handle,
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
