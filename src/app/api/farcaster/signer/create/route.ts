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

    // Check if user already has a signer - delete it first
    const { data: existingSigner } = await supabase
      .from("farcaster_signers")
      .select("*")
      .eq("user_did", auth.userId)
      .single();

    if (existingSigner) {
      console.log(`[Farcaster Signer] Deleting existing signer for user ${auth.userId}`);
      await supabase
        .from("farcaster_signers")
        .delete()
        .eq("user_did", auth.userId);
    }

    // Use Neynar API to create a managed signer
    console.log(`[Farcaster Signer] Creating new signer for FID ${fid}...`);
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
      const errorText = await neynarResponse.text();
      console.error("[Farcaster Signer] Neynar API error:");
      console.error("[Farcaster Signer] Status:", neynarResponse.status);
      console.error("[Farcaster Signer] Response:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }

      throw new Error(errorData.message || `Neynar API error (${neynarResponse.status})`);
    }

    const neynarData = await neynarResponse.json();

    console.log(`[Farcaster Signer] ✅ Full Neynar response:`, JSON.stringify(neynarData, null, 2));

    const { signer_uuid, public_key, signer_approval_url } = neynarData;

    if (!signer_uuid || !public_key || !signer_approval_url) {
      console.error("[Farcaster Signer] ❌ Missing required fields in Neynar response");
      console.error("[Farcaster Signer] signer_uuid:", signer_uuid);
      console.error("[Farcaster Signer] public_key:", public_key);
      console.error("[Farcaster Signer] signer_approval_url:", signer_approval_url);
      throw new Error("Invalid response from Neynar - missing required fields");
    }

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
