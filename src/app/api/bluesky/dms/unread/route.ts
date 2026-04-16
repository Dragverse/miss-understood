import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/dms/unread
 * Returns total unread DM count across all conversations.
 * Lightweight — no mutual-follow filtering, just sums unreadCount from listConvos.
 */
export async function GET(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json({ count: 0 });
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json({ count: 0 });
    }

    const chatAgent = (agent as any).withProxy("bsky_chat", "did:web:api.bsky.chat");
    const res = await (chatAgent as any).chat.bsky.convo.listConvos({ limit: 30 });
    const convos: any[] = res.data.convos ?? [];

    const count = convos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);

    return NextResponse.json({ count }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Non-fatal — return 0 silently
    return NextResponse.json({ count: 0 });
  }
}
