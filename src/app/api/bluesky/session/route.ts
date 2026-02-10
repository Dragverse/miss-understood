import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

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

    // Clear database connection status for consistency across all pages
    try {
      const auth = await verifyAuth(request);
      if (auth.authenticated && auth.userId) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabase
          .from("creators")
          .update({
            bluesky_handle: null,
            bluesky_did: null,
            updated_at: new Date().toISOString(),
          })
          .eq("did", auth.userId);

        if (updateError) {
          console.error("[Bluesky Disconnect] Database clear failed:", updateError);
        } else {
          console.log("[Bluesky Disconnect] ✅ Cleared connection from database");
        }
      }
    } catch (syncError) {
      // Non-fatal error - session is already cleared, database sync is supplementary
      console.error("[Bluesky Disconnect] Database clear error:", syncError);
    }

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
