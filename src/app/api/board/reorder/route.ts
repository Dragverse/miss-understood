import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { reorderBlocksSchema } from "@/lib/blocks/schemas";
import { validateBody } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/board/reorder
 *
 * Batched (column_index, position) writes after a drag or move. The client
 * sends the full new ordering rather than a delta, so a dropped request
 * cannot leave the board in a half-reordered state.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const creatorDid = auth.userId;

    const parsed = validateBody(reorderBlocksSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { blocks } = parsed.data;

    const supabase = getSupabaseServerClient();

    // Verify every id belongs to the caller in one query, so a crafted payload
    // can't reposition someone else's blocks.
    const ids = blocks.map((b) => b.id);
    const { data: owned, error: ownedError } = await supabase
      .from("profile_blocks")
      .select("id")
      .eq("creator_did", creatorDid)
      .in("id", ids);

    if (ownedError) {
      console.error("[Board] Reorder ownership check failed:", ownedError);
      return NextResponse.json({ error: "Failed to reorder blocks" }, { status: 500 });
    }

    if ((owned?.length ?? 0) !== ids.length) {
      return NextResponse.json(
        { error: "One or more blocks don't belong to you" },
        { status: 403 }
      );
    }

    // Supabase has no multi-row UPDATE with differing values, so these go out
    // in parallel. Positions are absolute, not relative, so a partial failure
    // leaves a consistent (if stale) board rather than a corrupted order.
    const results = await Promise.all(
      blocks.map((block) =>
        supabase
          .from("profile_blocks")
          .update({ column_index: block.columnIndex, position: block.position })
          .eq("id", block.id)
          .eq("creator_did", creatorDid)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[Board] Reorder write failed:", failed.error);
      return NextResponse.json({ error: "Failed to reorder blocks" }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: blocks.length });
  } catch (error) {
    console.error("[Board] Reorder error:", error);
    return NextResponse.json({ error: "Failed to reorder blocks" }, { status: 500 });
  }
}
