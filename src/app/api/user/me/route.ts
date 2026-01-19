import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { getPrivyUserProfile, extractDisplayName, extractHandle, extractAvatar, extractSocialHandles } from "@/lib/privy/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the authenticated user's verified DID/user_id from their JWT token
 * This ensures we use the same identifier that's stored in the database
 * Auto-creates creator profile if it doesn't exist
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the authentication token
    const auth = await verifyAuth(request);

    if (!auth.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized", reason: auth.error },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    // Check if creator profile exists
    let creator = await getCreatorByDID(userId);

    // If no creator, auto-create one
    if (!creator) {
      console.log(`[UserMe] No creator found for ${userId}, creating profile`);

      try {
        // Fetch Privy profile
        const privyUser = await getPrivyUserProfile(userId);

        if (!privyUser) {
          console.error(`[UserMe] Failed to fetch Privy user profile for ${userId}`);
          // Return user ID anyway, creator can be created later
          return NextResponse.json({
            success: true,
            userId,
            authenticated: true,
            creator: null,
          });
        }

        // Extract user data from Privy profile
        const displayName = extractDisplayName(privyUser);
        const handle = extractHandle(privyUser, userId);
        const avatar = extractAvatar(privyUser, userId);
        const socialHandles = extractSocialHandles(privyUser);

        // Create creator in Supabase
        const supabase = await createClient();
        const { data: newCreator, error: createError } = await supabase
          .from("creators")
          .insert({
            did: userId,
            handle,
            display_name: displayName,
            avatar,
            description: "",
            follower_count: 0,
            following_count: 0,
            verified: false,
            ...socialHandles,
          })
          .select()
          .single();

        if (createError) {
          console.error(`[UserMe] Failed to create creator:`, createError);
          // Return user ID anyway, creator can be created later
          return NextResponse.json({
            success: true,
            userId,
            authenticated: true,
            creator: null,
          });
        }

        creator = newCreator;
        console.log(`[UserMe] Auto-created creator profile:`, creator.id);
      } catch (error) {
        console.error(`[UserMe] Failed to auto-create creator:`, error);
        // Continue anyway - creator can be created later
      }
    }

    // Return the verified user ID (this is what's stored as creator_did in videos)
    return NextResponse.json({
      success: true,
      userId,
      authenticated: true,
      creator,
    });
  } catch (error) {
    console.error("Failed to verify user:", error);
    return NextResponse.json(
      { error: "Failed to verify user", authenticated: false },
      { status: 500 }
    );
  }
}
