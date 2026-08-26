/**
 * Creator Board — core types
 *
 * A profile is a two-column board of blocks the creator arranges.
 * See CREATOR_BOARD_ARCHITECTURE.md for the design.
 */

export const BLOCK_TYPES = [
  "about",
  "upcoming",
  "gallery",
  "video_showcase",
  "music",
  "livestream",
  "links",
  "text",
  "booking",
  "embed",
  "featured_friends",
  "tip_jar",
  "guestbook",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Mirrors the visibility vocabulary already used by posts.visibility. */
export const BLOCK_VISIBILITIES = [
  "public",
  "followers-only",
  "subscribers",
  "private",
] as const;

export type BlockVisibility = (typeof BLOCK_VISIBILITIES)[number];

/** 0 = left, 1 = right. */
export type ColumnIndex = 0 | 1;

export interface ProfileBlock {
  id: string;
  creatorId: string | null;
  creatorDid: string;
  type: BlockType;
  /** 0 = left, 1 = right. */
  columnIndex: ColumnIndex;
  /**
   * Orders across BOTH columns, not within one. This is what makes the
   * mobile single-column collapse preserve the creator's intended reading
   * order — flatten by `position` and you get the right stack.
   */
  position: number;
  /** Shape depends on `type`; validated by the type's Zod schema on write. */
  config: Record<string, unknown>;
  /** Creator override for the block heading. Falls back to the registry label. */
  title: string | null;
  visibility: BlockVisibility;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A block as sent to a viewer. When `locked` is true, `config` has been
 * stripped and the client renders a teaser with a subscribe prompt rather
 * than hiding the block — an invisible block converts nobody.
 */
export type ViewerBlock =
  | (ProfileBlock & { locked: false })
  | (Pick<ProfileBlock, "id" | "type" | "columnIndex" | "position" | "title" | "visibility"> & {
      locked: true;
      /** Why it's locked, so the teaser can say the right thing. */
      lockReason: "subscribers" | "followers-only";
    });

export interface BoardTheme {
  creatorDid: string;
  accentColor: string | null;
  backgroundKind: "default" | "color" | "gradient" | "image";
  backgroundValue: string | null;
  backgroundTile: boolean;
  fontPair: string;
  cardStyle: "solid" | "glass" | "outline" | "sticker";
  colorScheme: "light" | "dark" | null;
}

export interface Board {
  creatorDid: string;
  blocks: ViewerBlock[];
  theme: BoardTheme | null;
  /** True when the requesting viewer owns this board (enables edit mode). */
  isOwner: boolean;
}

/** Row shape as it comes back from Supabase (snake_case). */
export interface ProfileBlockRow {
  id: string;
  creator_id: string | null;
  creator_did: string;
  type: BlockType;
  column_index: number;
  position: number;
  config: Record<string, unknown> | null;
  title: string | null;
  visibility: BlockVisibility;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToBlock(row: ProfileBlockRow): ProfileBlock {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorDid: row.creator_did,
    type: row.type,
    columnIndex: row.column_index === 1 ? 1 : 0,
    position: row.position,
    config: row.config ?? {},
    title: row.title,
    visibility: row.visibility,
    hidden: row.hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Split blocks into the two rendered columns, each already ordered.
 * Callers rendering mobile should ignore this and sort the flat list by
 * `position` instead.
 */
export function splitIntoColumns<T extends { columnIndex: ColumnIndex; position: number }>(
  blocks: T[]
): [T[], T[]] {
  const byPosition = [...blocks].sort((a, b) => a.position - b.position);
  return [
    byPosition.filter((b) => b.columnIndex === 0),
    byPosition.filter((b) => b.columnIndex === 1),
  ];
}
