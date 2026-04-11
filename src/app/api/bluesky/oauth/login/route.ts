import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/bluesky/oauth-client";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * POST /api/bluesky/oauth/login
 * Initiates the Bluesky OAuth authorization flow.
 * Returns the authorization URL for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { handle } = body;

    if (!handle) {
      return NextResponse.json(
        { error: "Bluesky handle is required" },
        { status: 400 }
      );
    }

    const client = await getOAuthClient();

    // state carries the Privy user DID so we can link it in the callback
    const authUrl = await client.authorize(handle, {
      state: auth.userId,
    });

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error("[Bluesky OAuth] Login error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to initiate login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
