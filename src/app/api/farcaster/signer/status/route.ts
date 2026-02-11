import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSigner } from "@/lib/farcaster/signer";

/**
 * GET /api/farcaster/signer/status
 * Check if user's Farcaster signer is approved and ready for posting
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's signer from database
    const signer = await getSigner(auth.userId);

    if (!signer) {
      return NextResponse.json({
        approved: false,
        message: "No signer found. Please create a signer first.",
      });
    }

    // The encryptedPrivateKey field now stores the Neynar signer UUID
    const signerUuid = signer.encryptedPrivateKey;

    // Check signer status via Neynar API
    const neynarResponse = await fetch(`https://api.neynar.com/v2/farcaster/signer?signer_uuid=${signerUuid}`, {
      headers: {
        "api_key": process.env.NEYNAR_API_KEY || "",
      },
    });

    if (!neynarResponse.ok) {
      console.error("[Farcaster Signer Status] Neynar API error:", await neynarResponse.text());
      return NextResponse.json({
        approved: false,
        message: "Failed to check signer status",
      });
    }

    const neynarData = await neynarResponse.json();
    const isApproved = neynarData.status === "approved";

    console.log(`[Farcaster Signer Status] Full Neynar response:`, JSON.stringify(neynarData, null, 2));
    console.log(`[Farcaster Signer Status] Signer ${signerUuid} status: ${neynarData.status}`);
    console.log(`[Farcaster Signer Status] Approval URL field:`, neynarData.signer_approval_url);

    // Include approval URL if not yet approved
    const response: any = {
      approved: isApproved,
      fid: signer.fid,
      publicKey: signer.publicKey,
      status: neynarData.status,
      message: isApproved
        ? "Signer is approved and ready for posting"
        : "Signer pending approval. Please approve in Warpcast.",
    };

    // If not approved, include the approval URL from Neynar
    // Try multiple possible field names
    const approvalUrl = neynarData.signer_approval_url || neynarData.signerApprovalUrl || neynarData.approval_url;

    if (!isApproved && approvalUrl) {
      response.approvalUrl = approvalUrl;
      console.log(`[Farcaster Signer Status] Including approval URL in response:`, approvalUrl);
    } else if (!isApproved) {
      console.log(`[Farcaster Signer Status] ⚠️ No approval URL found in Neynar response`);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Farcaster Signer Status] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to check signer status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
