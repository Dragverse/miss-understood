/**
 * Address → coordinates, via OpenStreetMap's Nominatim.
 *
 * Nominatim is used because it needs no API key and no billing account, which
 * matters for a feature that would otherwise be blocked on procurement. The
 * tradeoff is its usage policy: a descriptive User-Agent is required, and bulk
 * or high-frequency querying is not allowed.
 *
 * We stay inside that comfortably by geocoding **once, when an event is
 * saved** — never on read, and never per page view. If this ever needs to run
 * over many events at once, it must be rate-limited to roughly 1 req/sec or
 * moved to a paid provider.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** Identifies us to Nominatim, as their policy requires. */
const USER_AGENT = "Dragverse/1.0 (+https://www.dragverse.app)";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Best-effort geocode. Returns null rather than throwing — an event without
 * coordinates should still save, it just won't show a map.
 */
export async function geocodeVenue(parts: {
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): Promise<Coordinates | null> {
  // Venue name first: "Bar Wonderland, Berlin" resolves better than a bare
  // street address for the kind of places these events happen in.
  const query = [parts.venueName, parts.address, parts.city, parts.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  if (!query) return null;

  try {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
    const response = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Don't hold up an event save if Nominatim is slow.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[Geocode] ${response.status} for "${query}"`);
      return null;
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const hit = results?.[0];
    if (!hit) return null;

    const latitude = Number.parseFloat(hit.lat);
    const longitude = Number.parseFloat(hit.lon);
    if (!isValidCoordinate(latitude, longitude)) return null;

    return { latitude, longitude };
  } catch (error) {
    // Includes the timeout above. A failed geocode is not a failed save.
    console.warn("[Geocode] Lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Reject out-of-range values and the null island (0,0), which is what a failed
 * parse tends to look like rather than a real venue.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/**
 * OpenStreetMap embed URL for a pin.
 *
 * `span` is how much area to show in degrees — smaller is more zoomed in.
 * ~0.008 is roughly a few streets, which is the useful scale for "where is
 * this venue".
 */
export function osmEmbedUrl(latitude: number, longitude: number, span = 0.008): string {
  const bbox = [
    longitude - span,
    latitude - span / 2,
    longitude + span,
    latitude + span / 2,
  ].join(",");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}

/**
 * Directions link. Falls back to a text search when there are no coordinates,
 * so there's always something tappable for a physical event.
 */
export function directionsUrl(parts: {
  latitude?: number | null;
  longitude?: number | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
}): string | null {
  if (
    typeof parts.latitude === "number" &&
    typeof parts.longitude === "number" &&
    isValidCoordinate(parts.latitude, parts.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${parts.latitude},${parts.longitude}`;
  }

  const text = [parts.venueName, parts.address, parts.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}
