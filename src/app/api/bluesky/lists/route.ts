import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/lists?actor={did}
 * Returns Bluesky lists for the given actor (defaults to the authenticated user).
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

    const actor = request.nextUrl.searchParams.get("actor") || blueskyDID;

    const res = await agent.app.bsky.graph.getLists({ actor, limit: 20 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lists = res.data.lists.map((list: any) => ({
      uri: list.uri,
      name: list.name,
      description: list.description || null,
      avatar: list.avatar || null,
      purpose: list.purpose,
      itemCount: list.listItemCount ?? 0,
    }));

    return NextResponse.json({ lists });
  } catch (error) {
    console.error("[lists] Error:", error);
    return NextResponse.json({ error: "Failed to load lists" }, { status: 500 });
  }
}
