import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import {
  resyncYouTubeChannel,
  disconnectYouTubeChannel,
  syncYouTubeChannelManual,
} from "@/lib/youtube/oauth-sync";

/**
 * POST /api/youtube/connect
 * Two modes:
 * 1. Connect channel: { channelInput: "@handle" or "UC..." or URL }
 * 2. Re-sync: no body (or empty body)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Mode 1: Connect channel by handle/URL
    if (body.channelInput) {
      const result = await syncYouTubeChannelManual(auth.userId, body.channelInput);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to connect channel" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        channelInfo: result.channelInfo,
      });
    }

    // Mode 2: Re-sync existing channel
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
      { error: "Failed to process YouTube request" },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YouTube Connect API] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect YouTube channel" },
      { status: 500 }
    );
  }
}
