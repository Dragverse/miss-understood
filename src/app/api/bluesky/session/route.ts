import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import {
  getBlueskyOAuthDID,
  getOAuthAgent,
  clearBlueskyOAuth,
} from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/session
 * Check if user has active Bluesky OAuth session
 */
export async function GET(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (auth?.authenticated && auth.userId) {
      const blueskyDID = await getBlueskyOAuthDID(auth.userId);

      if (blueskyDID) {
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
            return NextResponse.json({
              connected: true,
              method: "oauth",
              handle: blueskyDID,
            });
          }
        }
      }
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ connected: false });
  }
}

/**
 * DELETE /api/bluesky/session
 * Disconnect Bluesky account (OAuth + clear legacy cookies)
 */
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Bluesky account disconnected",
    });

    // Clear legacy iron-session cookie if it exists (one-time cleanup)
    try {
      const session = await getIronSession<SessionData>(
        request,
        response,
        sessionOptions
      );
      delete session.bluesky;
      await session.save();
    } catch {
      // Ignore — legacy cookie may not exist
    }

    // Clear OAuth + database
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));
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
