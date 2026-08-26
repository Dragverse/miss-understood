import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { assertBlockOwner } from "@/lib/supabase/blocks";
import { updateBlockSchema, validateBlockConfig } from "@/lib/blocks/schemas";
import { validateBody } from "@/lib/validation/schemas";
import { rowToBlock, type BlockType, type ProfileBlockRow } from "@/lib/blocks/types";

export const dynamic = "force-dynamic";

async function requireOwner(request: NextRequest, blockId: string) {
  if (!isPrivyConfigured()) {
    return { error: NextResponse.json({ error: "Authentication not configured" }, { status: 500 }) };
  }

  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const ownership = await assertBlockOwner(blockId, auth.userId);
  if (!ownership.ok) {
    return { error: NextResponse.json({ error: ownership.error }, { status: ownership.status }) };
  }

  return { creatorDid: auth.userId };
}

/**
 * PATCH /api/board/blocks/[id]
 * Update a block's config, title, visibility or hidden flag.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await requireOwner(request, id);
    if ("error" in guard) return guard.error;

    const parsed = validateBody(updateBlockSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.data;

    const supabase = getSupabaseServerClient();
    const updateData: Record<string, unknown> = {};

    if (input.config !== undefined) {
      // Re-read the type rather than trusting the client to send it: a config
      // validated against the wrong schema is exactly the bug this guards.
      const { data: existing } = await supabase
        .from("profile_blocks")
        .select("type")
        .eq("id", id)
        .single();

      const config = validateBlockConfig((existing?.type as BlockType) ?? "text", input.config);
      if (!config.success) {
        return NextResponse.json({ error: config.error }, { status: 400 });
      }
      updateData.config = config.data;
    }

    if (input.title !== undefined) updateData.title = input.title;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.hidden !== undefined) updateData.hidden = input.hidden;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profile_blocks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Board] Failed to update block:", error);
      return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
    }

    return NextResponse.json({ success: true, block: rowToBlock(data as ProfileBlockRow) });
  } catch (error) {
    console.error("[Board] Update block error:", error);
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
  }
}

/**
 * DELETE /api/board/blocks/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await requireOwner(request, id);
    if ("error" in guard) return guard.error;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("profile_blocks").delete().eq("id", id);

    if (error) {
      console.error("[Board] Failed to delete block:", error);
      return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Board] Delete block error:", error);
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
  }
}
