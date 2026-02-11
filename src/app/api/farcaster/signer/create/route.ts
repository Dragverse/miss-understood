import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { generateSigner, storeSigner } from "@/lib/farcaster/signer";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/signer/create
 * Generate a new Farcaster signer and return approval URL
 *
 * Flow:
 * 1. Generate Ed25519 key pair
 * 2. Store encrypted private key
 * 3. Return deeplink for Warpcast approval
 * 4. User approves in Warpcast app
 * 5. Poll /api/farcaster/signer/status to check approval
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

    console.log(`[Farcaster Signer] Creating signer for user ${auth.userId}`);

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

    // Generate new signer
    const { publicKey, encryptedPrivateKey } = await generateSigner();

    // Store in database
    await storeSigner(auth.userId, fid, publicKey, encryptedPrivateKey);

    // Create Warpcast deeplink for approval
    // Format: farcaster://signed-key-request?token=<public_key>
    const approvalUrl = `https://client.warpcast.com/deeplinks/signed-key-request?deeplinkUrl=dragverse://farcaster/signer&token=${publicKey}`;

    console.log(`[Farcaster Signer] ✅ Signer created for FID ${fid}`);
    console.log(`[Farcaster Signer] Approval URL: ${approvalUrl}`);

    return NextResponse.json({
      success: true,
      publicKey,
      approvalUrl,
      fid,
      message: "Signer created. User must approve in Warpcast to enable posting.",
    });
  } catch (error) {
    console.error("[Farcaster Signer] Creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create signer",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
