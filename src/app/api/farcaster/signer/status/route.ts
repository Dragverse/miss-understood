import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSigner, verifySigner } from "@/lib/farcaster/signer";

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

    // Get user's signer
    const signer = await getSigner(auth.userId);

    if (!signer) {
      return NextResponse.json({
        approved: false,
        message: "No signer found. Please create a signer first.",
      });
    }

    // Verify signer is registered with Farcaster protocol
    const isApproved = await verifySigner(signer.fid, signer.publicKey);

    return NextResponse.json({
      approved: isApproved,
      fid: signer.fid,
      publicKey: signer.publicKey,
      message: isApproved
        ? "Signer is approved and ready for posting"
        : "Signer pending approval. Please approve in Warpcast.",
    });
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
