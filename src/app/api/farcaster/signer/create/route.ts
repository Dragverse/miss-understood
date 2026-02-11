import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { generateSigner, storeSigner } from "@/lib/farcaster/signer";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/signer/create
 * Generate a new Farcaster signer using Neynar's Signer API
 *
 * Flow:
 * 1. Call Neynar API to create managed signer
 * 2. Store signer UUID and public key
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

    // Use Neynar API to create a managed signer
    const neynarResponse = await fetch("https://api.neynar.com/v2/farcaster/signer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": process.env.NEYNAR_API_KEY || "",
      },
      body: JSON.stringify({
        fid: fid,
      }),
    });

    if (!neynarResponse.ok) {
      const errorData = await neynarResponse.json();
      console.error("[Farcaster Signer] Neynar API error:", errorData);
      throw new Error(errorData.message || "Failed to create signer with Neynar");
    }

    const neynarData = await neynarResponse.json();
    const { signer_uuid, public_key, signer_approval_url } = neynarData;

    console.log(`[Farcaster Signer] ✅ Neynar signer created`);
    console.log(`[Farcaster Signer] Signer UUID: ${signer_uuid}`);
    console.log(`[Farcaster Signer] Public Key: ${public_key}`);
    console.log(`[Farcaster Signer] Approval URL: ${signer_approval_url}`);

    // Store signer UUID in database (we'll use Neynar's managed signer, not our own keys)
    const { error: dbError } = await supabase.from("farcaster_signers").upsert({
      user_did: auth.userId,
      fid: fid,
      public_key: public_key,
      encrypted_private_key: signer_uuid, // Store UUID instead of encrypted key
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("[Farcaster Signer] Database error:", dbError);
      throw new Error("Failed to store signer in database");
    }

    return NextResponse.json({
      success: true,
      publicKey: public_key,
      approvalUrl: signer_approval_url,
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
