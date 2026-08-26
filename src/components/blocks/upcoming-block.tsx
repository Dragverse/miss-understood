"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FiMapPin, FiExternalLink, FiCalendar, FiUsers } from "react-icons/fi";
import { BlockEmpty } from "./block-shell";
import {
  EVENT_KIND_LABELS,
  formatEventDate,
  formatEventLocation,
  type DragEvent,
} from "@/lib/events/types";
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
    return <p className="text-sm text-white/40">Loading dates…</p>;
  }

  const filtered =
    config.kinds.length > 0 ? events.filter((e) => config.kinds.includes(e.kind)) : events;

  if (filtered.length === 0) return <BlockEmpty message="No dates listed yet." />;

  return (
    <ul className="space-y-3">
      {filtered.map((event) => (
        <li key={event.id}>
          <EventRow event={event} />
        </li>
      ))}
    </ul>
  );
}

function EventRow({ event }: { event: DragEvent }) {
  const location = formatEventLocation(event);

  return (
    <article className="flex gap-3">
      {event.flyerUrl ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
          <Image src={event.flyerUrl} alt="" fill sizes="64px" className="object-cover" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-white/5 flex flex-col items-center justify-center flex-shrink-0">
          <FiCalendar aria-hidden="true" size={16} className="text-white/40" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <time
            dateTime={event.startsAt}
            className="text-[11px] uppercase tracking-wide text-[color:var(--board-accent,var(--color-dragverse-primary))]"
          >
            {formatEventDate(event.startsAt, event.timezone, { withTime: !event.isAllDay })}
          </time>
          <span className="text-[10px] uppercase tracking-wide text-white/35">
            {EVENT_KIND_LABELS[event.kind]}
          </span>
        </div>

        <h3 className="text-sm font-medium truncate">{event.title}</h3>

        {location && (
          <p className="flex items-center gap-1 text-xs text-white/55 truncate">
            <FiMapPin aria-hidden="true" size={11} className="flex-shrink-0" />
            {location}
          </p>
        )}

        {event.description && (
          <p className="mt-1 text-xs text-white/60 line-clamp-2 whitespace-pre-wrap">
            {event.description}
          </p>
        )}

        {event.lineup.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-white/45 truncate">
            <FiUsers aria-hidden="true" size={10} className="flex-shrink-0" />
            {event.lineup.join(" · ")}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          {(event.priceText || event.isFree) && (
            <span className="text-[11px] text-white/50">
              {event.isFree ? "Free" : event.priceText}
            </span>
          )}
          {event.ageRestriction && (
            <span className="text-[11px] text-white/50">{event.ageRestriction}</span>
          )}
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--board-accent,var(--color-dragverse-primary))] hover:underline"
            >
              Tickets
              <FiExternalLink aria-hidden="true" size={10} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
