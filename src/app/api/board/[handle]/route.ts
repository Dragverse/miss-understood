import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getCreatorByHandleOrDID } from "@/lib/supabase/creators";
import { getBoardForViewer } from "@/lib/supabase/blocks";

export const dynamic = "force-dynamic";

/**
 * GET /api/board/[handle]
 *
 * Resolves a creator's board for the requesting viewer, applying block
 * visibility server-side. Auth is optional: anonymous visitors get the public
 * board, a signed-in viewer additionally gets whatever they're entitled to.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    if (!handle) {
      return NextResponse.json({ error: "Handle is required" }, { status: 400 });
    }

    const creator = await getCreatorByHandleOrDID(handle);
    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Optional auth — an unauthenticated request is a normal visitor, not an
    // error, so a failed verify just means "no entitlements". The header is
    // checked first because verifyAuth console.errors on a missing one, and
    // most board views are anonymous.
    let viewerDid: string | undefined;
    if (request.headers.get("authorization")?.startsWith("Bearer ")) {
      const auth = await verifyAuth(request).catch(() => null);
      if (auth?.authenticated && auth.userId) viewerDid = auth.userId;
    }

    const board = await getBoardForViewer(creator.did, viewerDid);

    return NextResponse.json({
      success: true,
      board,
      creator: {
        did: creator.did,
        handle: creator.handle,
        displayName: creator.display_name,
        avatar: creator.avatar,
      },
    });
  } catch (error) {
    console.error("[Board] Failed to load board:", error);
    return NextResponse.json({ error: "Failed to load board" }, { status: 500 });
  }
}
