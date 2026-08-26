/**
 * Creator Board — data access.
 *
 * All reads go through the service-role client and apply visibility rules in
 * `toViewerBlock` below. The anon-key RLS policy on profile_blocks only exposes
 * `visibility = 'public'`, so if one of these paths is ever bypassed the
 * failure mode is "gated blocks are invisible", not "gated blocks leak".
 */

import { getSupabaseServerClient } from "@/lib/supabase/client";
import { validateBlockConfig } from "@/lib/blocks/schemas";
import {
  rowToBlock,
  type Board,
  type BoardTheme,
  type ProfileBlock,
  type ProfileBlockRow,
  type ViewerBlock,
} from "@/lib/blocks/types";

/**
 * Fill in schema defaults before a block reaches a renderer.
 *
 * Stored config cannot be trusted to be complete: the migration backfills
 * blocks with `'{}'::jsonb`, and rows can predate a schema gaining a field.
 * Renderers destructure config directly (`config.links.length`), so an
 * incomplete object is a crash, not a cosmetic problem. Normalising here means
 * every block component can assume a complete config.
 */
function withDefaults(block: ProfileBlock): ProfileBlock {
  const result = validateBlockConfig(block.type, block.config);
  if (result.success) return { ...block, config: result.data };

  // A config that fails validation outright (e.g. an embed with no url) still
  // must not take the board down — fall back to whatever defaults parse.
  const bare = validateBlockConfig(block.type, {});
  return { ...block, config: bare.success ? bare.data : {} };
}

interface ThemeRow {
  creator_did: string;
  accent_color: string | null;
  background_kind: BoardTheme["backgroundKind"] | null;
  background_value: string | null;
  background_tile: boolean | null;
  font_pair: string | null;
  card_style: BoardTheme["cardStyle"] | null;
  color_scheme: BoardTheme["colorScheme"];
}

function rowToTheme(row: ThemeRow): BoardTheme {
  return {
    creatorDid: row.creator_did,
    accentColor: row.accent_color,
    backgroundKind: row.background_kind ?? "default",
    backgroundValue: row.background_value,
    backgroundTile: row.background_tile ?? false,
    fontPair: row.font_pair ?? "default",
    cardStyle: row.card_style ?? "solid",
    colorScheme: row.color_scheme,
  };
}

/**
 * Decide what a given viewer may see of a block.
 *
 * Gated blocks come back as a locked teaser rather than being dropped: the
 * title and the reason survive, the config does not. An invisible block
 * teaches a visitor nothing; a locked one is the entire conversion path for
 * subscriptions.
 */
function toViewerBlock(
  block: ProfileBlock,
  opts: { isOwner: boolean; isFollower: boolean; isSubscriber: boolean }
): ViewerBlock | null {
  if (opts.isOwner) return { ...block, locked: false };

  // Hidden and private are for the owner's eyes only — no teaser, because
  // there is nothing a visitor could do to unlock them.
  if (block.hidden || block.visibility === "private") return null;

  if (block.visibility === "public") return { ...block, locked: false };

  const unlocked =
    (block.visibility === "followers-only" && opts.isFollower) ||
    (block.visibility === "subscribers" && opts.isSubscriber);

  if (unlocked) return { ...block, locked: false };

  return {
    id: block.id,
    type: block.type,
    columnIndex: block.columnIndex,
    position: block.position,
    title: block.title,
    visibility: block.visibility,
    locked: true,
    lockReason: block.visibility === "subscribers" ? "subscribers" : "followers-only",
  };
}

/**
 * Is `viewerDid` subscribed to `creatorDid`?
 *
 * Returns false while the subscriptions table does not yet exist (phase 3),
 * which means subscriber-gated blocks read as locked. That is the correct
 * failure direction: locked-when-entitled is a visible bug a creator will
 * report, open-when-not-entitled is a silent leak.
 */
async function isSubscriberOf(viewerDid: string, creatorDid: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("subscriber_did", viewerDid)
    .eq("creator_did", creatorDid)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;

  // NULL current_period_end means it never expires — that is the free tier.
  if (!data.current_period_end) return true;
  return new Date(data.current_period_end as string).getTime() > Date.now();
}

async function isFollowerOf(viewerDid: string, creatorDid: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_did", viewerDid)
    .eq("following_did", creatorDid)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Load a creator's board as a specific viewer sees it.
 */
export async function getBoardForViewer(
  creatorDid: string,
  viewerDid?: string
): Promise<Board> {
  const supabase = getSupabaseServerClient();
  const isOwner = !!viewerDid && viewerDid === creatorDid;

  const [blocksResult, themeResult] = await Promise.all([
    supabase
      .from("profile_blocks")
      .select("*")
      .eq("creator_did", creatorDid)
      .order("position", { ascending: true }),
    supabase
      .from("creator_themes")
      .select("*")
      .eq("creator_did", creatorDid)
      .maybeSingle(),
  ]);

  if (blocksResult.error) {
    console.error("[Board] Failed to load blocks:", blocksResult.error);
    throw blocksResult.error;
  }

  const blocks = ((blocksResult.data ?? []) as ProfileBlockRow[])
    .map(rowToBlock)
    .map(withDefaults);

  // Only pay for the entitlement lookups when a gated block actually exists.
  const needsFollower = !isOwner && blocks.some((b) => b.visibility === "followers-only");
  const needsSubscriber = !isOwner && blocks.some((b) => b.visibility === "subscribers");

  const [isFollower, isSubscriber] = await Promise.all([
    needsFollower && viewerDid ? isFollowerOf(viewerDid, creatorDid) : Promise.resolve(false),
    needsSubscriber && viewerDid ? isSubscriberOf(viewerDid, creatorDid) : Promise.resolve(false),
  ]);

  const viewerBlocks = blocks
    .map((block) => toViewerBlock(block, { isOwner, isFollower, isSubscriber }))
    .filter((block): block is ViewerBlock => block !== null);

  return {
    creatorDid,
    blocks: viewerBlocks,
    theme: themeResult.data ? rowToTheme(themeResult.data as ThemeRow) : null,
    isOwner,
  };
}

/** Owner-only: the raw board including hidden blocks, for the editor. */
export async function getOwnBoard(creatorDid: string): Promise<Board> {
  return getBoardForViewer(creatorDid, creatorDid);
}

/**
 * Next free slot at the bottom of a column. `position` is global across both
 * columns, so this is max+1 over the whole board rather than per column.
 */
export async function nextPosition(creatorDid: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("profile_blocks")
    .select("position")
    .eq("creator_did", creatorDid)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data?.position as number | undefined) ?? -1) + 1;
}

/** Confirm a block belongs to the caller before mutating it. */
export async function assertBlockOwner(
  blockId: string,
  creatorDid: string
): Promise<{ ok: true } | { ok: false; status: 404 | 403; error: string }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("profile_blocks")
    .select("id, creator_did")
    .eq("id", blockId)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 404, error: "Block not found" };
  if (data.creator_did !== creatorDid) {
    return { ok: false, status: 403, error: "You don't have permission to edit this block" };
  }
  return { ok: true };
}
