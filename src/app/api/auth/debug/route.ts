import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * Debug endpoint to test authentication
 * DELETE THIS AFTER DEBUGGING
 */
export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Debug: Checking authentication...");

    const authHeader = request.headers.get("authorization");
    console.log("🔍 Auth header:", authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : "missing");

    const auth = await verifyAuth(request);

    return NextResponse.json({
      authenticated: auth.authenticated,
      userId: auth.userId,
      error: auth.error,
      timestamp: new Date().toISOString(),
      privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ? "configured" : "missing",
    });
  } catch (error) {
    console.error("🔍 Debug endpoint error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
