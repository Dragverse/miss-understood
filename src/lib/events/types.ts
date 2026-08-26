/**
 * Events — gigs, shows, livestreams and premieres as one scheduling primitive.
 *
 * Most events are physical: a booking at a venue, with a flyer, a description
 * and a ticket link. Online events point at the record that actually does the
 * work (a stream or a video) instead of duplicating it.
 */

import { z } from "zod";

export const EVENT_KINDS = ["gig", "show", "livestream", "premiere", "workshop", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  gig: "Gig",
  show: "Show",
  livestream: "Livestream",
  premiere: "Premiere",
  workshop: "Workshop",
  other: "Other",
};

/** Kinds that happen somewhere physical, and so show venue fields. */
export const PHYSICAL_KINDS: EventKind[] = ["gig", "show", "workshop", "other"];

export interface DragEvent {
  id: string;
  creatorDid: string;
  title: string;
  description: string | null;
  flyerUrl: string | null;
  kind: EventKind;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  isAllDay: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ticketUrl: string | null;
  priceText: string | null;
  isFree: boolean;
  ageRestriction: string | null;
  lineup: string[];
  hostName: string | null;
  visibility: string;
  cancelledAt: string | null;
  interestedCount: number;
}

export interface EventRow {
  id: string;
  creator_did: string;
  title: string;
  description: string | null;
  flyer_url: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  is_all_day: boolean;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ticket_url: string | null;
  price_text: string | null;
  is_free: boolean;
  age_restriction: string | null;
  lineup: string[] | null;
  host_name: string | null;
  visibility: string;
  cancelled_at: string | null;
  interested_count: number;
}

export function rowToEvent(row: EventRow): DragEvent {
  return {
    id: row.id,
    creatorDid: row.creator_did,
    title: row.title,
    description: row.description,
    flyerUrl: row.flyer_url,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    isAllDay: row.is_all_day,
    venueName: row.venue_name,
    address: row.address,
    city: row.city,
    region: row.region,
    country: row.country,
    ticketUrl: row.ticket_url,
    priceText: row.price_text,
    isFree: row.is_free,
    ageRestriction: row.age_restriction,
    lineup: row.lineup ?? [],
    hostName: row.host_name,
    visibility: row.visibility,
    cancelledAt: row.cancelled_at,
    interestedCount: row.interested_count ?? 0,
  };
}

// ============================================
// Validation
// ============================================

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) link");

/** Flyers are uploaded through /api/upload/image-v2, so they live on our storage. */
const flyerUrl = httpUrl.refine((value) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return true;
  try {
    return new URL(value).hostname.toLowerCase() === new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}, "Flyer must be uploaded to Dragverse");

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a name").max(200),
    description: z.string().trim().max(5000).nullish(),
    flyerUrl: flyerUrl.nullish(),
    kind: z.enum(EVENT_KINDS).default("gig"),

    /** ISO instant. The client converts the creator's local input to UTC. */
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).nullish(),
    /** IANA zone the time was entered in — needed for correct local display. */
    timezone: z.string().trim().max(64).default("UTC"),
    isAllDay: z.boolean().default(false),

    venueName: z.string().trim().max(200).nullish(),
    address: z.string().trim().max(300).nullish(),
    city: z.string().trim().max(120).nullish(),
    region: z.string().trim().max(120).nullish(),
    country: z.string().trim().max(2).nullish(),

    ticketUrl: httpUrl.nullish(),
    /** Free text: real door policies are "£8 adv / £10 door", not a number. */
    priceText: z.string().trim().max(120).nullish(),
    isFree: z.boolean().default(false),
    ageRestriction: z.string().trim().max(20).nullish(),

    lineup: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
    hostName: z.string().trim().max(200).nullish(),

    visibility: z.enum(["public", "followers-only", "subscribers", "private"]).default("public"),
  })
  .refine(
    (event) => !event.endsAt || new Date(event.endsAt) >= new Date(event.startsAt),
    { message: "The end time can't be before the start time", path: ["endsAt"] }
  );

export const eventUpdateSchema = eventInputSchema;

export type EventInput = z.infer<typeof eventInputSchema>;

/** Map camelCase input onto the snake_case row the database expects. */
export function eventInputToRow(input: EventInput, creatorDid: string, creatorId?: string) {
  return {
    creator_did: creatorDid,
    ...(creatorId ? { creator_id: creatorId } : {}),
    title: input.title,
    description: input.description ?? null,
    flyer_url: input.flyerUrl ?? null,
    kind: input.kind,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    timezone: input.timezone,
    is_all_day: input.isAllDay,
    venue_name: input.venueName ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    country: input.country ?? null,
    ticket_url: input.ticketUrl ?? null,
    price_text: input.priceText ?? null,
    is_free: input.isFree,
    age_restriction: input.ageRestriction ?? null,
    lineup: input.lineup,
    host_name: input.hostName ?? null,
    visibility: input.visibility,
  };
}

// ============================================
// Display helpers
// ============================================

/**
 * Render an event's start time in the zone it was created in, not the
 * viewer's. A gig at 10pm in Berlin reads "10pm" to everyone — that's the
 * whole reason `timezone` is stored alongside the UTC instant.
 */
export function formatEventDate(
  startsAt: string,
  timezone: string,
  options: { withTime?: boolean } = {}
): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(options.withTime === false ? {} : { hour: "numeric", minute: "2-digit" }),
      timeZone: timezone || "UTC",
    });
  } catch {
    // An unknown IANA zone shouldn't blank the date out.
    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
}

/** "Bar Wonderland, Berlin" — whichever parts exist. */
export function formatEventLocation(event: Pick<DragEvent, "venueName" | "city" | "kind">): string {
  if (event.kind === "livestream" || event.kind === "premiere") return "Online";
  return [event.venueName, event.city].filter(Boolean).join(", ");
}
