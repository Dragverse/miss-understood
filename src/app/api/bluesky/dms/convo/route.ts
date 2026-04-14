import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * POST /api/bluesky/dms/convo
 * Body: { did: string }
 * Returns (or creates) a DM conversation with the given user DID.
 */
export async function POST(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { did } = await request.json();
    if (!did) {
      return NextResponse.json({ error: "did is required" }, { status: 400 });
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
    const res = await chatAgent.chat.bsky.convo.getConvoForMembers({
      members: [blueskyDID, did],
    });

    return NextResponse.json({ convo: res.data.convo });
  } catch (error) {
    console.error("[dms/convo] Error:", error);
    return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 });
  }
}
