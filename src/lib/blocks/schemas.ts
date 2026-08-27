/**
 * Creator Board — per-block config validation.
 *
 * `profile_blocks.config` is jsonb and the database does NOT validate its
 * shape. These schemas are the only thing standing between a creator and a
 * malformed board, so every write path must run the config through
 * `validateBlockConfig` before it touches Supabase.
 */

import { z } from "zod";
import { BLOCK_TYPES, BLOCK_VISIBILITIES, type BlockType } from "./types";

/** Only http(s). Blocks javascript:, data: and friends. */
const externalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) URL");

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour");

/**
 * Media the creator uploaded, which must live on our own Supabase storage.
 *
 * Accepting an arbitrary remote URL here would leak every visitor's IP to a
 * third party and let the image be swapped for something else after a
 * moderator had looked at it. Uploads go through /api/upload/image-v2, which
 * returns exactly this shape of URL.
 *
 * Falls back to accepting any https URL when NEXT_PUBLIC_SUPABASE_URL is
 * absent, so a misconfigured environment can't silently reject every legit
 * upload — the host check is a hardening measure, not the auth boundary.
 */
const mediaUrl = externalUrl.refine((value) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return value.startsWith("https://");
  try {
    const allowedHost = new URL(supabaseUrl).hostname.toLowerCase();
    const host = new URL(value).hostname.toLowerCase();
    return host === allowedHost;
  } catch {
    return false;
  }
}, "Images must be uploaded to Dragverse");

/**
 * Embeds are restricted to a host allowlist rather than accepting arbitrary
 * iframe URLs. An open embed block is an open redirect and a clickjacking
 * surface, and there is no way to sanitise a third-party frame after the fact.
 */
export const EMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "open.spotify.com",
  "bandcamp.com",
  "soundcloud.com",
  "w.soundcloud.com",
  "vimeo.com",
  "player.vimeo.com",
] as const;

const embedUrl = externalUrl.refine((value) => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return EMBED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}, `Embeds must come from: ${EMBED_HOSTS.join(", ")}`);

// ============================================
// Per-block config schemas
// ============================================

export const upcomingConfigSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  /** Past events drop off automatically; this shows a few for context. */
  showPast: z.boolean().default(false),
  kinds: z
    .array(z.enum(["gig", "show", "livestream", "premiere", "workshop", "other"]))
    .default([]),
});

/** An image uploaded straight into a block, rather than derived from a post. */
export const blockImageSchema = z.object({
  url: mediaUrl,
  caption: z.string().trim().max(200).optional(),
});

export const galleryConfigSchema = z.object({
  /**
   * Photos uploaded to this gallery from the dashboard. When non-empty these
   * win outright; the post-derived fallback below only applies to galleries
   * the creator hasn't curated yet, so an existing board keeps working.
   */
  images: z.array(blockImageSchema).max(60).default([]),
  limit: z.number().int().min(1).max(60).default(12),
  /**
   * `slider` is the default: a board column is narrow, and a horizontal strip
   * shows more of a set than a cramped grid does. `single` shows just the
   * first image, for a creator who wants one photo to carry the block.
   */
  layout: z.enum(["slider", "grid", "single"]).default("slider"),
  /** Slides visible at once in slider layout; ignored for a single image. */
  perView: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  /** Only applies to the post-derived fallback. */
  tag: z.string().trim().max(60).optional(),
  showCaptions: z.boolean().default(true),
});

/**
 * Notes are `posts` rows without media — the block only chooses how many to
 * show. The writing itself happens in the dashboard composer.
 */
export const notesConfigSchema = z.object({
  limit: z.number().int().min(1).max(30).default(5),
  /** Collapse long notes behind a "more" toggle rather than filling a column. */
  truncate: z.boolean().default(true),
});

export const videoShowcaseConfigSchema = z.object({
  limit: z.number().int().min(1).max(24).default(6),
  /** Explicit ordering wins; otherwise newest first. */
  pinnedVideoIds: z.array(z.uuid()).max(24).default([]),
  /**
   * `hero` highlights a single video — `featuredVideoId` if set, else the
   * first pinned one, else the newest.
   */
  layout: z.enum(["slider", "grid", "list", "hero"]).default("grid"),
  /** Only meaningful for `hero`. */
  featuredVideoId: z.uuid().optional(),
  /** Slides visible at once in slider layout. */
  perView: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  showTitles: z.boolean().default(true),
});

export const musicConfigSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  pinnedTrackIds: z.array(z.uuid()).max(50).default([]),
  autoplay: z.literal(false).default(false), // never autoplay audio
});

export const livestreamConfigSchema = z.object({
  showOfflinePlaceholder: z.boolean().default(true),
  showChat: z.boolean().default(true),
});

export const linksConfigSchema = z.object({
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        url: externalUrl,
        icon: z.string().trim().max(40).optional(),
      })
    )
    .max(30)
    .default([]),
  style: z.enum(["buttons", "list", "icons"]).default("buttons"),
});

export const textConfigSchema = z.object({
  /**
   * Plain text with newlines, NOT html. Rendered through a text node, never
   * dangerouslySetInnerHTML. If rich text is wanted later it needs a real
   * sanitiser, not a relaxation of this field.
   */
  body: z.string().max(5000).default(""),
  align: z.enum(["left", "center", "right"]).default("left"),
});

export const bookingConfigSchema = z.object({
  email: z.email().max(200).optional(),
  bookingUrl: externalUrl.optional(),
  ratesNote: z.string().trim().max(500).optional(),
  travelsFrom: z.string().trim().max(120).optional(),
  willTravel: z.boolean().default(true),
  riderUrl: externalUrl.optional(),
});

export const embedConfigSchema = z.object({
  url: embedUrl,
  caption: z.string().trim().max(200).optional(),
});

export const featuredFriendsConfigSchema = z.object({
  limit: z.number().int().min(1).max(24).default(8),
  showNotes: z.boolean().default(true),
});

export const tipJarConfigSchema = z.object({
  headline: z.string().trim().max(120).default("Support my work"),
  suggestedAmounts: z.array(z.number().positive().max(10000)).max(5).default([5, 10, 25]),
});

export const guestbookConfigSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  /**
   * Defaults to true. A creator can be harassed on their own page before they
   * notice otherwise, and this platform's users are a targeted group.
   * Opting out is a deliberate choice, not the default.
   */
  moderated: z.boolean().default(true),
  allowAnonymous: z.literal(false).default(false),
});

// ============================================
// Registry of schemas
// ============================================

export const BLOCK_CONFIG_SCHEMAS = {
  upcoming: upcomingConfigSchema,
  gallery: galleryConfigSchema,
  video_showcase: videoShowcaseConfigSchema,
  music: musicConfigSchema,
  livestream: livestreamConfigSchema,
  links: linksConfigSchema,
  notes: notesConfigSchema,
  text: textConfigSchema,
  booking: bookingConfigSchema,
  embed: embedConfigSchema,
  featured_friends: featuredFriendsConfigSchema,
  tip_jar: tipJarConfigSchema,
  guestbook: guestbookConfigSchema,
} as const satisfies Record<BlockType, z.ZodType>;

export type BlockConfigMap = {
  [K in BlockType]: z.infer<(typeof BLOCK_CONFIG_SCHEMAS)[K]>;
};

/**
 * Validate and normalise a block's config. Returns defaults filled in, so the
 * stored config is always complete and renderers never need `?? fallback`.
 */
export function validateBlockConfig(
  type: BlockType,
  config: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const schema = BLOCK_CONFIG_SCHEMAS[type];
  if (!schema) return { success: false, error: `Unknown block type: ${type}` };

  const result = schema.safeParse(config ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join(", ");
    return { success: false, error: message };
  }

  return { success: true, data: result.data as Record<string, unknown> };
}

/** Defaults for a freshly added block. */
export function defaultConfigFor(type: BlockType): Record<string, unknown> {
  const result = validateBlockConfig(type, {});
  // Every schema must parse {} — embed is the exception since `url` is required.
  return result.success ? result.data : {};
}

// ============================================
// Request schemas for the board API
// ============================================

export const createBlockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  columnIndex: z.union([z.literal(0), z.literal(1)]).default(0),
  config: z.unknown().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  visibility: z.enum(BLOCK_VISIBILITIES).default("public"),
});

export const updateBlockSchema = z.object({
  config: z.unknown().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  visibility: z.enum(BLOCK_VISIBILITIES).optional(),
  hidden: z.boolean().optional(),
});

export const reorderBlocksSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.uuid(),
        columnIndex: z.union([z.literal(0), z.literal(1)]),
        position: z.number().int().min(0).max(9999),
      })
    )
    .min(1)
    .max(100),
});

export const updateThemeSchema = z.object({
  accentColor: hexColor.nullable().optional(),
  backgroundKind: z.enum(["default", "color", "gradient", "image"]).optional(),
  backgroundValue: z.string().trim().max(2048).nullable().optional(),
  backgroundTile: z.boolean().optional(),
  fontPair: z.string().trim().max(40).optional(),
  cardStyle: z.enum(["solid", "glass", "outline", "sticker"]).optional(),
  colorScheme: z.enum(["light", "dark"]).nullable().optional(),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
export type ReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
