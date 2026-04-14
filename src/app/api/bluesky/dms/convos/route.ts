import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

/**
 * GET /api/bluesky/dms/convos
 * Returns DM conversations filtered to mutual followers only.
 * A "mutual follow" means the current user follows them AND they follow back.
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
    const res = await chatAgent.chat.bsky.convo.listConvos({ limit: 40 });
    const convos: any[] = res.data.convos ?? [];

    if (convos.length === 0) {
      return NextResponse.json({ convos: [] });
    }

    // Collect unique DIDs of other participants
    const otherDIDs = Array.from(
      new Set(
        convos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((c: any) => c.members?.find((m: any) => m.did !== blueskyDID)?.did)
          .filter(Boolean) as string[]
      )
    );

    // Batch-check mutual follow status via getRelationships
    // Each relationship has { did, following, followedBy } — both set = mutual follow
    let mutualDIDs = new Set<string>();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relRes = await (agent as any).app.bsky.graph.getRelationships({
        actor: blueskyDID,
        others: otherDIDs,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mutualDIDs = new Set<string>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (relRes.data.relationships ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => r.following && r.followedBy)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r.did)
      );
    } catch (err) {
      // If relationship check fails, fall back to showing all convos
      console.warn("[dms/convos] getRelationships failed, showing all convos:", err);
      return NextResponse.json({ convos });
    }

    // Only surface conversations with mutual followers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = convos.filter((c: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const other = c.members?.find((m: any) => m.did !== blueskyDID);
      return other && mutualDIDs.has(other.did);
    });

    return NextResponse.json({ convos: filtered });
  } catch (error) {
    console.error("[dms/convos] Error:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
