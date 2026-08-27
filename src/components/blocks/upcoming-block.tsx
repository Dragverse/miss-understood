"use client";

import { useEffect, useState } from "react";
import { BlockEmpty } from "./block-shell";
import { EventCard } from "./event-card";
import type { DragEvent } from "@/lib/events/types";
import type { BlockViewProps } from "./index";

/**
 * The creator's upcoming dates — physical gigs and online events in one list.
 *
 * Fetches its own data rather than using BlockContent: events are the only
 * consumer, so loading them for every board would be wasted work on the
 * majority of profiles that have none.
 */
export function UpcomingBlock({ config, content }: BlockViewProps<"upcoming">) {
  const [events, setEvents] = useState<DragEvent[] | null>(null);
  const handle = content.creator.handle;

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({
          handle,
          limit: String(config.limit),
          ...(config.showPast ? { includePast: "true" } : {}),
        });
        const response = await fetch(`/api/events?${params}`);
        const data = await response.json();
        if (cancelled) return;
        setEvents(response.ok ? (data.events ?? []) : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, config.limit, config.showPast]);

  if (events === null) {
    return <p className="text-sm opacity-50">Loading dates…</p>;
  }

  const filtered =
    config.kinds.length > 0 ? events.filter((e) => config.kinds.includes(e.kind)) : events;

  if (filtered.length === 0) return <BlockEmpty message="No dates listed yet." />;

  return (
    <ul className="space-y-2.5">
      {filtered.map((event) => (
        <li key={event.id}>
          <EventCard event={event} compact />
        </li>
      ))}
    </ul>
  );
}

/**
 * Kept as `EventRow` for the profile Events tab and /events, which import it
 * by that name. Compact on the board where space is tight, full elsewhere.
 */
export function EventRow({ event }: { event: DragEvent }) {
  return <EventCard event={event} compact />;
}
