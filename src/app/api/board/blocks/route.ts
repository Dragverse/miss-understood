import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { nextPosition } from "@/lib/supabase/blocks";
import { createBlockSchema, validateBlockConfig } from "@/lib/blocks/schemas";
import { validateBody } from "@/lib/validation/schemas";
import { rowToBlock, type ProfileBlockRow } from "@/lib/blocks/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/board/blocks
 * Add a block to the authenticated creator's own board.
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

    const parsed = validateBody(createBlockSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.data;

    // config is jsonb and the database will accept anything — this is the
    // only shape check between the client and the stored board.
    const config = validateBlockConfig(input.type, input.config);
    if (!config.success) {
      return NextResponse.json({ error: config.error }, { status: 400 });
    }

    const creator = await getCreatorByDID(creatorDid);
    if (!creator) {
      return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profile_blocks")
      .insert({
        creator_id: creator.id,
        creator_did: creatorDid,
        type: input.type,
        column_index: input.columnIndex,
        position: await nextPosition(creatorDid),
        config: config.data,
        title: input.title ?? null,
        visibility: input.visibility,
      })
      .select()
      .single();

    if (error) {
      console.error("[Board] Failed to create block:", error);
      return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
    }

    return NextResponse.json({ success: true, block: rowToBlock(data as ProfileBlockRow) });
  } catch (error) {
    console.error("[Board] Create block error:", error);
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
  }
}
