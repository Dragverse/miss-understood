import { NextRequest, NextResponse } from "next/server";
// import { NeynarAPIClient } from "@neynar/nodejs-sdk"; // Will be used once signer flow is implemented
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getPrivyClient } from "@/lib/privy/server";

/**
 * POST /api/farcaster/post
 * Cross-post content to Farcaster /dragverse channel
 *
 * Request body:
 * - text: string (cast text content)
 * - videoUrl?: string (optional video embed)
 * - imageUrl?: string (optional image embed)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;
    // videoUrl and imageUrl will be used once signer integration is complete

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Text content is required" },
        { status: 400 }
      );
    }

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
          message: "Please connect your Farcaster account in Settings to cross-post",
        },
        { status: 400 }
      );
    }

    // Verify Neynar API key is configured
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error("[Farcaster Post] NEYNAR_API_KEY not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster integration not configured",
        },
        { status: 500 }
      );
    }
    // Neynar client will be initialized once signer flow is implemented

    // Check for Privy's embedded signer
    const signerPublicKey = (farcasterAccount as any).signerPublicKey;
    const fid = (farcasterAccount as any).fid;

    if (!signerPublicKey || !fid) {
      console.warn("[Farcaster Post] Incomplete Farcaster account for user", user.id, {
        hasSignerPublicKey: !!signerPublicKey,
        hasFid: !!fid,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster signer not configured",
          message: "Your Farcaster account needs to authorize a signer. Please reconnect your Farcaster account in Settings.",
          requiresSignerAuth: true,
        },
        { status: 400 }
      );
    }

    // TODO: Implement Neynar managed signer creation
    // For now, we need to create a managed signer via Neynar API
    // This requires a separate flow to register the Privy signer with Neynar
    //
    // Implementation steps needed:
    // 1. Call Neynar API to create a managed signer with the FID
    // 2. Store the returned signerUuid in our database linked to the user
    // 3. Use that signerUuid for future posts
    //
    // Reference: https://docs.neynar.com/docs/how-to-let-users-connect-farcaster-accounts

    console.error("[Farcaster Post] Neynar managed signer integration not yet implemented");
    return NextResponse.json(
      {
        success: false,
        error: "Farcaster posting temporarily unavailable",
        message: "We're working on enabling Farcaster cross-posting. This feature will be available soon!",
        details: "Neynar managed signer integration pending - we need to create a flow to register signers",
      },
      { status: 501 } // 501 Not Implemented
    );
  } catch (error: any) {
    console.error("[Farcaster Post] Failed to publish cast:", error);

    // Handle specific Neynar API errors
    if (error.response?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Farcaster credentials",
          message: "Please reconnect your Farcaster account",
        },
        { status: 401 }
      );
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many posts. Please try again later.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to post to Farcaster",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
