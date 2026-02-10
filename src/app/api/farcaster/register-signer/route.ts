import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getPrivyClient } from "@/lib/privy/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/farcaster/register-signer
 * Create a Neynar managed signer for the user's Farcaster account
 *
 * This endpoint should be called when:
 * 1. User first connects their Farcaster account
 * 2. User tries to cross-post but doesn't have a signer yet
 *
 * The flow:
 * 1. Verify user authentication
 * 2. Get user's Farcaster FID from Privy
 * 3. Create a managed signer via Neynar API
 * 4. Store the signerUuid in the database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { success: false, error: "Authentication system not configured" },
        { status: 500 }
      );
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    // Fetch user's Privy profile to get Farcaster account
    const privyClient = getPrivyClient();
    const user = await privyClient.users()._get(auth.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has Farcaster linked
    const farcasterAccount = user.linked_accounts?.find(
      (account: any) => account.type === "farcaster"
    ) as any;

    if (!farcasterAccount?.fid) {
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster not connected",
          message: "Please connect your Farcaster account in Settings first",
        },
        { status: 400 }
      );
    }

    const fid = farcasterAccount.fid;
    const farcasterUsername = farcasterAccount.username || null;

    console.log("[Farcaster Register] Processing registration for:", {
      userId: auth.userId,
      fid,
      username: farcasterUsername,
    });

    // Ensure creator profile exists and has Farcaster info
    const supabase = getSupabaseServerClient();
    const { data: existingCreator, error: fetchError } = await supabase
      .from("creators")
      .select("id, farcaster_fid, farcaster_signer_uuid")
      .eq("did", auth.userId)
      .single();

    if (fetchError) {
      console.error("[Farcaster Register] Creator profile not found:", fetchError);
      return NextResponse.json(
        {
          success: false,
          error: "Creator profile not found",
          message: "Please refresh the page and try again",
        },
        { status: 400 }
      );
    }

    // Check if signer already exists
    if (existingCreator.farcaster_signer_uuid) {
      console.log("[Farcaster Register] Signer already exists:", existingCreator.farcaster_signer_uuid);
      return NextResponse.json(
        {
          success: true,
          signerUuid: existingCreator.farcaster_signer_uuid,
          message: "Signer already registered",
          alreadyExists: true,
        }
      );
    }

    // Initialize Neynar client
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error("[Farcaster Register] NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Farcaster integration not configured" },
        { status: 500 }
      );
    }

    const neynar = new NeynarAPIClient({ apiKey });

    console.log("[Farcaster Register] Creating managed signer for FID:", fid);

    // Create a managed signer via Neynar API
    // This returns a signer_uuid and a deeplink for the user to approve in Warpcast
    let signerResponse;
    try {
      signerResponse = await neynar.createSigner();
    } catch (neynarError: any) {
      console.error("[Farcaster Register] Neynar API error:", {
        message: neynarError.message,
        status: neynarError.response?.status,
        data: neynarError.response?.data,
      });
      throw neynarError;
    }

    if (!signerResponse || !signerResponse.signer_uuid) {
      console.error("[Farcaster Register] Failed to create signer - no UUID returned");
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create Farcaster signer",
          details: "Neynar API did not return a signer UUID",
        },
        { status: 500 }
      );
    }

    const signerUuid = signerResponse.signer_uuid;
    const signerApprovalUrl = signerResponse.signer_approval_url;

    console.log("[Farcaster Register] ✅ Signer created successfully", {
      signerUuid,
      fid,
      approvalUrl: signerApprovalUrl,
    });

    // Store the signerUuid, FID, and handle in the database
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        farcaster_signer_uuid: signerUuid,
        farcaster_fid: fid,
        farcaster_handle: farcasterUsername,
      })
      .eq("did", auth.userId);

    if (updateError) {
      console.error("[Farcaster Register] Failed to store signer UUID:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save signer",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Note: The signer needs to be approved by the user via the signerApprovalUrl
    // No additional API calls needed - the approval URL handles everything

    return NextResponse.json({
      success: true,
      signerUuid,
      signerApprovalUrl,
      message: "Signer created successfully. Please approve it in Warpcast using the provided URL.",
    });
  } catch (error: any) {
    console.error("[Farcaster Register] Failed to create signer:", error);

    // Handle specific Neynar API errors
    if (error.response?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Neynar API credentials",
          details: "API key may be incorrect or expired",
        },
        { status: 401 }
      );
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Farcaster signer",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/farcaster/register-signer
 * Check if user has a registered signer
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { success: false, error: "Authentication system not configured" },
        { status: 500 }
      );
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has a signer UUID in database
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creators")
      .select("farcaster_signer_uuid")
      .eq("did", auth.userId)
      .single();

    if (error) {
      console.error("[Farcaster Register] Failed to fetch signer:", error);
      return NextResponse.json(
        { success: false, error: "Failed to check signer status" },
        { status: 500 }
      );
    }

    const hasSigner = !!data?.farcaster_signer_uuid;

    return NextResponse.json({
      success: true,
      hasSigner,
      signerUuid: data?.farcaster_signer_uuid || null,
    });
  } catch (error: any) {
    console.error("[Farcaster Register] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check signer status" },
      { status: 500 }
    );
  }
}
