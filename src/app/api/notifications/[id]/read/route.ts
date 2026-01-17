import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

/**
 * PATCH /api/notifications/[id]/read
 * Mark a notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const response = NextResponse.json({ error: "Not authenticated" });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (!session.bluesky?.did) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id: notificationId } = await params;

    // TODO: Update notification in Ceramic to mark as read
    // Verify the notification belongs to the authenticated user

    return NextResponse.json({
      success: true,
      notificationId,
      read: true,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return NextResponse.json(
      {
        error: "Failed to mark notification as read",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
