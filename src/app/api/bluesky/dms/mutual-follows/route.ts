import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/dms/mutual-follows
 * Returns Bluesky accounts that mutually follow the authenticated user.
 * Used to populate the "New Message" recipient picker.
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

    // getFollows with the authenticated agent includes viewer context:
    // viewer.followedBy is set when the followed person also follows the current user back.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (agent as any).app.bsky.graph.getFollows({
      actor: blueskyDID,
      limit: 100,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutuals = (res.data.follows ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.viewer?.followedBy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({
        did: f.did as string,
        handle: f.handle as string,
        displayName: (f.displayName as string | undefined) ?? f.handle,
        avatar: (f.avatar as string | undefined) ?? null,
      }));

    return NextResponse.json({ mutuals });
  } catch (error) {
    console.error("[dms/mutual-follows] Error:", error);
    return NextResponse.json({ error: "Failed to load mutual follows" }, { status: 500 });
  }
}
