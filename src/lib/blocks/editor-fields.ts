/**
 * Creator Board — editable fields per block type.
 *
 * A declarative spec rather than a bespoke editor component per block. Adding
 * a setting means adding a line here and a field to the Zod schema; the
 * dashboard editor renders it automatically and validation stays in one place.
 */

import type { BlockType } from "./types";

export type EditorField =
  | { kind: "text"; key: string; label: string; placeholder?: string; help?: string }
  | { kind: "textarea"; key: string; label: string; placeholder?: string; rows?: number }
  | { kind: "number"; key: string; label: string; min: number; max: number; help?: string }
  | { kind: "toggle"; key: string; label: string; help?: string }
  | { kind: "select"; key: string; label: string; options: Array<{ value: string | number; label: string }> }
  | { kind: "links"; key: string; label: string }
  /** Upload, caption, reorder and remove images stored on the block itself. */
  | { kind: "images"; key: string; label: string; help?: string }
  /** Pick one of the creator's own videos. */
  | { kind: "videoPicker"; key: string; label: string; help?: string };

/**
 * Fields shown for each block type. Types absent from this map have nothing
 * worth configuring, and the editor says so rather than showing an empty form.
 */
export const BLOCK_EDITOR_FIELDS: Partial<Record<BlockType, EditorField[]>> = {
  about: [
    { kind: "text", key: "pronouns", label: "Pronouns", placeholder: "she/her" },
    { kind: "text", key: "basedIn", label: "Based in", placeholder: "Berlin" },
    { kind: "text", key: "dragFamily", label: "Drag family", placeholder: "House of…" },
    { kind: "toggle", key: "showPronouns", label: "Show pronouns" },
    { kind: "toggle", key: "showBasedIn", label: "Show where you're based" },
    { kind: "toggle", key: "showDragFamily", label: "Show drag family" },
  ],

  notes: [
    { kind: "number", key: "limit", label: "Notes to show", min: 1, max: 30 },
    {
      kind: "toggle",
      key: "truncate",
      label: "Collapse long notes",
      help: "Shows a 'more' link instead of filling the column.",
    },
  ],

  gallery: [
    {
      kind: "images",
      key: "images",
      label: "Photos",
      help: "Upload your own. Leave empty to show photos from your posts instead.",
    },
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "slider", label: "Slider — swipeable strip" },
        { value: "grid", label: "Grid — all at once" },
        { value: "single", label: "Single — one photo only" },
      ],
    },
    { kind: "toggle", key: "showCaptions", label: "Show captions" },
    {
      kind: "select",
      key: "perView",
      label: "Photos per slide",
      options: [
        { value: 1, label: "1 — large" },
        { value: 2, label: "2" },
        { value: 3, label: "3 — compact" },
      ],
    },
    {
      kind: "select",
      key: "columns",
      label: "Grid columns",
      options: [
        { value: 2, label: "2" },
        { value: 3, label: "3" },
        { value: 4, label: "4" },
      ],
    },
    { kind: "number", key: "limit", label: "Photos to show", min: 1, max: 60 },
    {
      kind: "text",
      key: "tag",
      label: "Only show photos tagged",
      placeholder: "leave empty for all",
    },
  ],

  video_showcase: [
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "grid", label: "Grid" },
        { value: "slider", label: "Slider — swipeable strip" },
        { value: "hero", label: "Hero — one video only" },
        { value: "list", label: "List" },
      ],
    },
    {
      kind: "videoPicker",
      key: "featuredVideoId",
      label: "Highlighted video",
      help: "Which video carries the block. Defaults to your newest.",
    },
    {
      kind: "select",
      key: "perView",
      label: "Videos per slide",
      options: [
        { value: 1, label: "1 — large" },
        { value: 2, label: "2" },
        { value: 3, label: "3 — compact" },
      ],
    },
    { kind: "number", key: "limit", label: "Videos to show", min: 1, max: 24 },
    { kind: "toggle", key: "showTitles", label: "Show titles" },
  ],

  music: [{ kind: "number", key: "limit", label: "Tracks to show", min: 1, max: 50 }],

  links: [
    { kind: "links", key: "links", label: "Links" },
    {
      kind: "select",
      key: "style",
      label: "Style",
      options: [
        { value: "buttons", label: "Buttons" },
        { value: "list", label: "List" },
        { value: "icons", label: "Icons" },
      ],
    },
  ],

  booking: [
    { kind: "text", key: "email", label: "Booking email", placeholder: "bookings@…" },
    { kind: "text", key: "bookingUrl", label: "Booking link", placeholder: "https://…" },
    { kind: "text", key: "travelsFrom", label: "Travelling from", placeholder: "Madrid" },
    { kind: "toggle", key: "willTravel", label: "Available to travel" },
    {
      kind: "textarea",
      key: "ratesNote",
      label: "Rates & notes",
      placeholder: "What promoters should know.",
      rows: 3,
    },
    { kind: "text", key: "riderUrl", label: "Tech rider link", placeholder: "https://…" },
  ],

  text: [
    { kind: "textarea", key: "body", label: "Text", rows: 6 },
    {
      kind: "select",
      key: "align",
      label: "Alignment",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Centre" },
        { value: "right", label: "Right" },
      ],
    },
  ],
};

export function editorFieldsFor(type: BlockType): EditorField[] {
  return BLOCK_EDITOR_FIELDS[type] ?? [];
}

/**
 * Layout-specific settings are mutually irrelevant — showing all of them at
 * once makes the form look broken. Hide whichever doesn't apply.
 */
export function isFieldRelevant(
  type: BlockType,
  field: EditorField,
  config: Record<string, unknown>
): boolean {
  const layout = config.layout;

  if (type === "gallery") {
    if (field.key === "perView") return layout === "slider";
    if (field.key === "columns") return layout === "grid";
    // A single photo has nothing to page through and no count to cap.
    if (field.key === "limit") return layout !== "single";
    return true;
  }

  if (type === "video_showcase") {
    if (field.key === "perView") return layout === "slider";
    if (field.key === "featuredVideoId") return layout === "hero";
    if (field.key === "limit") return layout !== "hero";
    return true;
  }

  return true;
}
