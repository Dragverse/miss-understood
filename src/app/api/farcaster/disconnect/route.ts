import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/disconnect
 * Clear Farcaster connection data from database when user disconnects
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

    console.log(`[Farcaster Disconnect] Clearing Farcaster data for user ${auth.userId}`);

    const supabase = getSupabaseServerClient();

    // Clear Farcaster FID and username from creators table
    const { error: creatorError } = await supabase
      .from("creators")
      .update({
        farcaster_fid: null,
        farcaster_username: null,
        updated_at: new Date().toISOString(),
      })
      .eq("did", auth.userId);

    if (creatorError) {
      console.error("[Farcaster Disconnect] Failed to clear creator data:", creatorError);
      throw new Error("Failed to clear Farcaster connection");
    }

    // Delete any Farcaster signers
    const { error: signerError } = await supabase
      .from("farcaster_signers")
      .delete()
      .eq("user_did", auth.userId);

    if (signerError) {
      console.error("[Farcaster Disconnect] Failed to delete signer:", signerError);
      // Non-critical - continue even if signer deletion fails
    }

    console.log(`[Farcaster Disconnect] ✅ Successfully cleared Farcaster data for user ${auth.userId}`);

    return NextResponse.json({
      success: true,
      message: "Farcaster disconnected successfully",
    });
  } catch (error) {
    console.error("[Farcaster Disconnect] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect Farcaster",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
