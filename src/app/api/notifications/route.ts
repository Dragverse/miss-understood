import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { getAggregatedNotifications, getUnreadCount } from "@/lib/supabase/notifications";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * GET /api/notifications
 * Fetch aggregated notifications for the authenticated user (Dragverse + Bluesky)
 * Supports both Privy and Bluesky authentication
 */
export async function GET(request: NextRequest) {
  try {
    let userDID: string | null = null;

    // Try Privy authentication first
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (auth.authenticated && auth.userId) {
        userDID = auth.userId;
      }
    }

    // Fall back to Bluesky session if Privy auth failed
    if (!userDID) {
      const response = NextResponse.json({ error: "Not authenticated" });
      const session = await getIronSession<SessionData>(
        request,
        response,
        sessionOptions
      );

      if (session.bluesky?.did) {
        userDID = session.bluesky.did;
      }
    }

    // If still no authentication, return 401
    if (!userDID) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get Bluesky notifications if user has Bluesky connected
    // TODO: Integrate with Bluesky API to fetch their notifications
    const blueskyNotifs: any[] = [];

    // Get aggregated notifications from Supabase (Dragverse) + Bluesky
    const notifications = await getAggregatedNotifications(
      userDID,
      blueskyNotifs,
      50
    );

    const unreadCount = await getUnreadCount(userDID);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Notification fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
