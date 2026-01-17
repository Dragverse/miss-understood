import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

/**
 * GET /api/bluesky/session
 * Check if user has active Bluesky session
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({ connected: false });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (!session.bluesky) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      handle: session.bluesky.handle,
      displayName: session.bluesky.displayName,
      avatar: session.bluesky.avatar,
      connectedAt: session.bluesky.connectedAt,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ connected: false });
  }
}

/**
 * DELETE /api/bluesky/session
 * Disconnect Bluesky account (clear session)
 */
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Bluesky account disconnected",
    });

    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    // Clear Bluesky session data
    delete session.bluesky;
    await session.save();

    return response;
  } catch (error) {
    console.error("Session disconnect error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disconnect account",
      },
      { status: 500 }
    );
  }
}
