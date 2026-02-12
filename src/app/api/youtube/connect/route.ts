import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import {
  resyncYouTubeChannel,
  disconnectYouTubeChannel,
  lookupYouTubeChannel,
  initiateYouTubeVerification,
  verifyYouTubeChannel,
} from "@/lib/youtube/oauth-sync";

/**
 * POST /api/youtube/connect
 * Modes (via body.mode):
 *   "lookup"   - Preview channel info (no DB write)
 *   "initiate" - Save channel + generate verification code
 *   "verify"   - Check channel description for verification code
 *   (none)     - Re-sync existing channel subscriber count
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Mode: Lookup (preview only, no DB changes)
    if (body.mode === "lookup" && body.channelInput) {
      const channelInfo = await lookupYouTubeChannel(body.channelInput);
      if (!channelInfo) {
        return NextResponse.json(
          { error: "Channel not found. Please check your YouTube handle or URL." },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, channelInfo });
    }

    // Mode: Initiate verification (save channel + generate code)
    if (body.mode === "initiate" && body.channelInput) {
      const result = await initiateYouTubeVerification(auth.userId, body.channelInput);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to initiate verification" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        channelInfo: result.channelInfo,
        verificationCode: result.verificationCode,
      });
    }

    // Mode: Verify (check description for code)
    if (body.mode === "verify") {
      const result = await verifyYouTubeChannel(auth.userId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Verification failed" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        channelInfo: result.channelInfo,
      });
    }

    // Default: Re-sync existing channel
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
