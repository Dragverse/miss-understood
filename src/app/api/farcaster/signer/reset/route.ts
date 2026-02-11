import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/signer/reset
 * Delete existing signer to allow user to start over
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

    console.log(`[Farcaster Signer Reset] Deleting signer for user ${auth.userId}`);

    const supabase = getSupabaseServerClient();

    // Delete existing signer
    const { error } = await supabase
      .from("farcaster_signers")
      .delete()
      .eq("user_did", auth.userId);

    if (error) {
      console.error("[Farcaster Signer Reset] Delete error:", error);
      throw new Error("Failed to delete signer");
    }

    console.log(`[Farcaster Signer Reset] ✅ Signer deleted successfully`);

    return NextResponse.json({
      success: true,
      message: "Signer reset successfully",
    });
  } catch (error) {
    console.error("[Farcaster Signer Reset] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to reset signer",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
