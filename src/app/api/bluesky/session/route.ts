import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyAuthFromCookies } from "@/lib/auth/verify";
import {
  getBlueskyOAuthDID,
  getOAuthAgent,
  clearBlueskyOAuth,
} from "@/lib/bluesky/oauth-client";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/bluesky/session
 * Check if user has active Bluesky session (OAuth or legacy)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Try OAuth session first
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (auth?.authenticated && auth.userId) {
      const blueskyDID = await getBlueskyOAuthDID(auth.userId);

      if (blueskyDID) {
        // Try to get an active OAuth agent
        const agent = await getOAuthAgent(blueskyDID);
        if (agent) {
          try {
            const profile = await agent.getProfile({ actor: blueskyDID });
            return NextResponse.json({
              connected: true,
              method: "oauth",
              handle: profile.data.handle,
              displayName: profile.data.displayName,
              avatar: profile.data.avatar,
            });
          } catch (profileError) {
            console.error(
              "[Bluesky Session] OAuth profile fetch failed:",
              profileError
            );
            // Session exists but profile failed - still connected
            return NextResponse.json({
              connected: true,
              method: "oauth",
              handle: blueskyDID,
            });
          }
        }
      }
    }

    // 2. Fall back to legacy iron-session cookie
    const response = NextResponse.json({ connected: false });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (session.bluesky) {
      return NextResponse.json({
        connected: true,
        method: "legacy",
        handle: session.bluesky.handle,
        displayName: session.bluesky.displayName,
        avatar: session.bluesky.avatar,
        connectedAt: session.bluesky.connectedAt,
      });
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ connected: false });
  }
}

/**
 * DELETE /api/bluesky/session
 * Disconnect Bluesky account (OAuth + legacy)
 */
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Bluesky account disconnected",
    });

    // Clear legacy iron-session
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );
    delete session.bluesky;
    await session.save();

    // Clear OAuth + database
    const auth = await verifyAuth(request).catch(() => null);
    if (auth?.authenticated && auth.userId) {
      await clearBlueskyOAuth(auth.userId);
    }

    return response;
  } catch (error) {
    console.error("Session disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
