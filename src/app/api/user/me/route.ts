import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * Get the authenticated user's verified DID/user_id from their JWT token
 * This ensures we use the same identifier that's stored in the database
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the authentication token
    const auth = await verifyAuth(request);

    if (!auth.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized", reason: auth.error },
        { status: 401 }
      );
    }

    // Return the verified user ID (this is what's stored as creator_did in videos)
    return NextResponse.json({
      success: true,
      userId: auth.userId,
      authenticated: true,
    });
  } catch (error) {
    console.error("Failed to verify user:", error);
    return NextResponse.json(
      { error: "Failed to verify user", authenticated: false },
      { status: 500 }
    );
  }
}
