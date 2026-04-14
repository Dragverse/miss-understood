import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/dms/messages?convoId={id}
 * Returns messages for a specific DM conversation.
 */
export async function GET(request: NextRequest) {
  try {
    const convoId = request.nextUrl.searchParams.get("convoId");
    if (!convoId) {
      return NextResponse.json({ error: "convoId is required" }, { status: 400 });
    }

    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json({ error: "No Bluesky account connected" }, { status: 401 });
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json({ error: "Bluesky session expired" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatAgent = (agent as any).withProxy("bsky_chat", "did:web:api.bsky.chat");
    const res = await chatAgent.chat.bsky.convo.getMessages({ convoId, limit: 50 });

    return NextResponse.json({ messages: res.data.messages });
  } catch (error) {
    console.error("[dms/messages] Error:", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
