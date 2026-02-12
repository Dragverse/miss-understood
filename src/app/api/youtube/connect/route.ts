import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import {
  generateYouTubeOAuthUrl,
  resyncYouTubeChannel,
  disconnectYouTubeChannel,
} from "@/lib/youtube/oauth-sync";
import crypto from "crypto";

/**
 * GET /api/youtube/connect
 * Generate YouTube OAuth authorization URL
 * Returns URL for frontend to redirect user to Google consent screen
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate CSRF state token with encoded user ID
    // Format: {randomToken}:{userDID}
    const csrfToken = crypto.randomBytes(16).toString("hex");
    const state = `${csrfToken}:${auth.userId}`;

    const authUrl = generateYouTubeOAuthUrl(state);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error("[YouTube Connect API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate OAuth URL" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/youtube/connect
 * Re-sync YouTube channel data (refresh subscriber count)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await resyncYouTubeChannel(auth.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to re-sync channel" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      channelInfo: result.channelInfo,
    });
  } catch (error) {
    console.error("[YouTube Connect API] Error:", error);
    return NextResponse.json(
      { error: "Failed to re-sync YouTube channel" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/youtube/connect
 * Disconnect YouTube channel from creator profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await disconnectYouTubeChannel(auth.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to disconnect channel" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[YouTube Connect API] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect YouTube channel" },
      { status: 500 }
    );
  }
}
