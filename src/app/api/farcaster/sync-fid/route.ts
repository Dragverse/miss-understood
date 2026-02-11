import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getPrivyUserProfile } from "@/lib/privy/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/sync-fid
 * Simple endpoint to sync just the Farcaster FID from Privy to database
 * Called when user links Farcaster and we need to enable crossposting
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    console.log("[Farcaster Sync] Syncing FID for user:", userId);

    // Fetch Privy user profile
    const privyUser = await getPrivyUserProfile(userId);
    if (!privyUser) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Extract Farcaster account from linked accounts
    const farcasterAccount = privyUser.linked_accounts?.find(
      (account: any) => account.type === "farcaster"
    ) as any;

    if (!farcasterAccount || !farcasterAccount.fid) {
      return NextResponse.json(
        {
          error: "Farcaster not linked",
          message: "Please link your Farcaster account first",
        },
        { status: 400 }
      );
    }

    const farcasterFID = farcasterAccount.fid;
    const farcasterUsername = farcasterAccount.username || null;

    console.log("[Farcaster Sync] Found Farcaster account:", {
      fid: farcasterFID,
      username: farcasterUsername,
    });

    // Update creator record with Farcaster FID
    const supabase = getSupabaseServerClient();
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        farcaster_fid: farcasterFID,
        farcaster_handle: farcasterUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("did", userId);

    if (updateError) {
      console.error("[Farcaster Sync] Update error:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update profile",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log("[Farcaster Sync] ✅ FID synced successfully");

    return NextResponse.json({
      success: true,
      farcasterFID,
      farcasterUsername,
      message: "Farcaster profile synced successfully",
    });
  } catch (error) {
    console.error("[Farcaster Sync] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync Farcaster profile",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
