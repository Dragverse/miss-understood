import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { syncFarcasterFollowers } from "@/lib/farcaster/followers";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/followers/sync
 * Sync Farcaster followers for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log(`[Farcaster Followers Sync] Syncing for user ${auth.userId}`);

    // Get user's Farcaster FID
    const supabase = getSupabaseServerClient();
    const { data: creator } = await supabase
      .from("creators")
      .select("farcaster_fid")
      .eq("did", auth.userId)
      .single();

    if (!creator?.farcaster_fid) {
      return NextResponse.json(
        {
          error: "Farcaster not connected",
          message: "Please connect your Farcaster account first",
        },
        { status: 400 }
      );
    }

    const fid = creator.farcaster_fid;

    // Sync followers
    const result = await syncFarcasterFollowers(auth.userId, fid);

    if (result.success) {
      console.log(
        `[Farcaster Followers Sync] ✅ Synced ${result.count} followers`
      );

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `Synced ${result.count} Farcaster followers`,
      });
    } else {
      console.error(
        "[Farcaster Followers Sync] ❌ Sync failed:",
        result.error
      );

      return NextResponse.json(
        {
          error: "Failed to sync followers",
          details: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Farcaster Followers Sync] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync Farcaster followers",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
