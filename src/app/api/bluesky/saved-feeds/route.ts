import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/saved-feeds
 * Returns the user's saved (pinned) feed generators from their AT Protocol preferences.
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

    // Fetch actor preferences to find saved feed URIs
    const prefsRes = await agent.app.bsky.actor.getPreferences();
    const prefs = prefsRes.data.preferences;

    // Find the savedFeedsPrefV2 preference item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedFeedsPref = prefs.find((p: any) => p.$type === "app.bsky.actor.defs#savedFeedsPrefV2") as any;

    if (!savedFeedsPref?.items?.length) {
      return NextResponse.json({ feeds: [] });
    }

    // Extract feed generator URIs (type === "feed")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feedUris: string[] = (savedFeedsPref.items as any[])
      .filter((item) => item.type === "feed" && item.value?.startsWith("at://"))
      .map((item) => item.value as string);

    if (feedUris.length === 0) {
      return NextResponse.json({ feeds: [] });
    }

    // Fetch generator metadata in one batch call
    const genRes = await agent.app.bsky.feed.getFeedGenerators({ feeds: feedUris });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feeds = (genRes.data.feeds as any[]).map((gen) => ({
      uri: gen.uri,
      displayName: gen.displayName || gen.uri,
      description: gen.description || null,
      avatar: gen.avatar || null,
      likeCount: gen.likeCount ?? 0,
    }));

    return NextResponse.json({ feeds });
  } catch (error) {
    console.error("[saved-feeds] Error:", error);
    return NextResponse.json({ error: "Failed to load saved feeds" }, { status: 500 });
  }
}
