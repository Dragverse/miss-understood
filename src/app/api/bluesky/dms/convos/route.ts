import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/dms/convos
 * Returns the list of DM conversations for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
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
    const res = await chatAgent.chat.bsky.convo.listConvos({ limit: 20 });

    return NextResponse.json({ convos: res.data.convos });
  } catch (error) {
    console.error("[dms/convos] Error:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
