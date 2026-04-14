import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";
import { blueskyPostToContent } from "@/lib/bluesky/client";

/**
 * GET /api/bluesky/list-feed?uri={listUri}&cursor={cursor}
 * Fetches posts from a Bluesky list feed.
 */
export async function GET(request: NextRequest) {
  try {
    const uri = request.nextUrl.searchParams.get("uri");
    const cursor = request.nextUrl.searchParams.get("cursor") || undefined;

    if (!uri || !uri.startsWith("at://")) {
      return NextResponse.json({ error: "Valid list AT-URI required" }, { status: 400 });
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

    const res = await agent.app.bsky.feed.getListFeed({ list: uri, limit: 30, cursor });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = res.data.feed.map((item: any) => blueskyPostToContent(item.post)).filter(Boolean);

    return NextResponse.json({ posts, cursor: res.data.cursor });
  } catch (error) {
    console.error("[list-feed] Error:", error);
    return NextResponse.json({ error: "Failed to load list feed" }, { status: 500 });
  }
}
