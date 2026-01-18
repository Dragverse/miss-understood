import { NextRequest, NextResponse } from "next/server";
import { revokeShareToken } from "@/lib/utils/share-tokens";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * POST /api/video/share/revoke
 * Revokes a share token
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    let userDID = "anonymous";
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userDID = auth.userId || "anonymous";
    } else {
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tokenId } = body;

    if (!tokenId) {
      return NextResponse.json(
        { error: "tokenId is required" },
        { status: 400 }
      );
    }

    // Revoke the token
    const result = await revokeShareToken(tokenId, userDID);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to revoke token" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Share token revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking share token:", error);
    return NextResponse.json(
      { error: "Failed to revoke share token" },
      { status: 500 }
    );
  }
}
