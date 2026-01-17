import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
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

    // TODO: Query Ceramic for notifications where recipientDID = session.bluesky.did
    // For now, return mock data
    const notifications = [
      {
        id: "1",
        type: "like",
        senderDID: "did:example:123",
        senderName: "Jane Doe",
        senderAvatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=jane",
        message: "liked your post",
        sourceType: "post",
        sourceId: "post-123",
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "2",
        type: "comment",
        senderDID: "did:example:456",
        senderName: "John Smith",
        senderAvatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=john",
        message: "commented on your video",
        sourceType: "video",
        sourceId: "video-456",
        read: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "3",
        type: "follow",
        senderDID: "did:example:789",
        senderName: "Alice Wonder",
        senderAvatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=alice",
        message: "started following you",
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
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

/**
 * POST /api/notifications
 * Create a new notification (when someone likes, comments, follows)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { recipientDID, type, message, sourceType, sourceId } = body;

    if (!recipientDID || !type || !message) {
      return NextResponse.json(
        { error: "Missing required fields: recipientDID, type, message" },
        { status: 400 }
      );
    }

    // TODO: Create notification in Ceramic
    // For now, return success
    return NextResponse.json({
      success: true,
      notification: {
        id: Date.now().toString(),
        recipientDID,
        senderDID: session.bluesky.did,
        type,
        message,
        sourceType,
        sourceId,
        read: false,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Notification creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
