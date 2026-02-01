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
 * Sync creator profile with latest social handles from Privy
 * ONLY updates social connection data (bluesky_handle, twitter, etc.) for follower aggregation
 * NEVER overwrites Dragverse profile data (handle, display_name, avatar, description)
 *
 * The user's Dragverse profile is sacred - only they can change it via settings.
 * This sync only populates social handles for the follower stats feature.
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

    // Check if user already has a profile
    const existingCreator = await getCreatorByDID(userDID);

    // Extract Bluesky session data (if user has connected Bluesky)
    const blueskyData = await extractBlueskyFromSession(request);

    // Extract ONLY social handles - do NOT extract or use profile display data
    const socialHandles = extractSocialHandles(privyUser);

    // CRITICAL: Only update social handles, NEVER overwrite Dragverse profile data
    const creatorData: any = {
      did: userDID,
      ...socialHandles, // Twitter, Instagram, TikTok handles for follower aggregation
      ...(blueskyData && {
        bluesky_handle: blueskyData.handle,
        bluesky_did: blueskyData.did || "",
      }),
    };

    // If this is a brand new user (no existing profile), set initial defaults
    // Otherwise, DO NOT touch handle, display_name, avatar, banner, or description
    if (!existingCreator) {
      console.log("[Sync Profile] New user - setting initial defaults from Privy");
      creatorData.handle = extractHandle(privyUser, userDID);
      creatorData.display_name = extractDisplayName(privyUser);
      creatorData.avatar = extractAvatar(privyUser, userDID);
      creatorData.description = "";
    } else {
      console.log("[Sync Profile] Existing user - preserving Dragverse profile data");
    }

    console.log("[Sync Profile] Syncing social handles only:", {
      bluesky_handle: creatorData.bluesky_handle,
      twitter_handle: creatorData.twitter_handle,
      instagram_handle: creatorData.instagram_handle,
      preserving_profile: !!existingCreator,
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
