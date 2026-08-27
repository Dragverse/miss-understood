"use client";

import { useState } from "react";
import Image from "next/image";
import { FiMapPin, FiExternalLink, FiCalendar, FiUsers, FiMap, FiNavigation } from "react-icons/fi";
import { useLightbox } from "@/components/shared/image-lightbox";
import {
  EVENT_KIND_LABELS,
  formatEventDate,
  formatEventLocation,
  type DragEvent,
} from "@/lib/events/types";
import { osmEmbedUrl, directionsUrl, isValidCoordinate } from "@/lib/events/geocode";

/**
 * One event, flyer-led.
 *
 * The flyer is the poster the creator made — it carries the whole identity of
 * the night, so it gets the top of the card at its own proportions rather than
 * being shrunk into a thumbnail beside the text.
 */
export function EventCard({ event, compact = false }: { event: DragEvent; compact?: boolean }) {
  const location = formatEventLocation(event);
  const lightbox = useLightbox(event.flyerUrl ? [{ url: event.flyerUrl, caption: event.title }] : []);
  const [showMap, setShowMap] = useState(false);

  const hasCoords =
    typeof event.latitude === "number" &&
    typeof event.longitude === "number" &&
    isValidCoordinate(event.latitude, event.longitude);

  const directions = directionsUrl(event);

  return (
    <article className="overflow-hidden rounded-[24px] bg-black/[0.06]">
      {event.flyerUrl ? (
        <button
          type="button"
          onClick={() => lightbox.open(0)}
          aria-label={`Expand flyer for ${event.title}`}
          className="group relative block w-full cursor-zoom-in bg-black/20"
        >
          {/* Flyers are usually portrait A-poster shapes. Natural proportions
              rather than a fixed ratio, so nothing is cut off. */}
          <Image
            src={event.flyerUrl}
            alt=""
            width={1200}
            height={1600}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="w-full h-auto object-contain"
          />
          {event.cancelledAt && (
            <span className="absolute top-3 left-3 rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Cancelled
            </span>
          )}
        </button>
      ) : (
        <div className="flex h-24 items-center justify-center bg-black/10">
          <FiCalendar aria-hidden="true" size={22} className="opacity-25" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <time
            dateTime={event.startsAt}
            className="text-[11px] font-bold uppercase tracking-wide opacity-75"
          >
            {formatEventDate(event.startsAt, event.timezone, { withTime: !event.isAllDay })}
          </time>
          <span className="text-[10px] uppercase tracking-wide opacity-45">
            {EVENT_KIND_LABELS[event.kind]}
          </span>
        </div>

        <h3 className="font-heading text-xl sm:text-2xl uppercase leading-[0.95] mt-0.5">
          {event.title}
        </h3>

        {location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm opacity-75">
            <FiMapPin aria-hidden="true" size={13} className="flex-shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}

        {event.address && !compact && (
          <p className="mt-0.5 text-xs opacity-55">{event.address}</p>
        )}

        {event.description && (
          <p className={`mt-2 text-sm opacity-80 whitespace-pre-wrap ${compact ? "line-clamp-2" : ""}`}>
            {event.description}
          </p>
        )}

        {event.lineup.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs opacity-65">
            <FiUsers aria-hidden="true" size={12} className="mt-0.5 flex-shrink-0" />
            <span>{event.lineup.join(" · ")}</span>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {(event.priceText || event.isFree) && (
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold uppercase">
              {event.isFree ? "Free" : event.priceText}
            </span>
          )}
          {event.ageRestriction && (
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold uppercase">
              {event.ageRestriction}
            </span>
          )}

          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-action-yellow)] px-3 py-1.5 text-[11px] font-bold uppercase text-[color:var(--color-card-ink)] hover:opacity-90 transition-opacity"
            >
              Tickets
              <FiExternalLink aria-hidden="true" size={11} />
            </a>
          )}

          {/* Map is opt-in per card: an iframe per event would be a lot of
              third-party requests on a page listing twenty of them. */}
          {hasCoords && (
            <button
              type="button"
              onClick={() => setShowMap((open) => !open)}
              aria-expanded={showMap}
              className="inline-flex items-center gap-1 rounded-full bg-black/10 px-3 py-1.5 text-[11px] font-bold uppercase hover:bg-black/20 transition-colors"
            >
              <FiMap aria-hidden="true" size={11} />
              {showMap ? "Hide map" : "Map"}
            </button>
          )}

          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 rounded-full bg-black/10 px-3 py-1.5 text-[11px] font-bold uppercase hover:bg-black/20 transition-colors"
            >
              <FiNavigation aria-hidden="true" size={11} />
              Directions
            </a>
          )}
        </div>

        {showMap && hasCoords && (
          <div className="mt-3 overflow-hidden rounded-2xl border-2 border-black/10">
            <iframe
              // OpenStreetMap needs no API key and no billing account.
              src={osmEmbedUrl(event.latitude!, event.longitude!)}
              title={`Map of ${event.venueName || location || event.title}`}
              loading="lazy"
              // Referrer withheld so OSM doesn't learn which profile was viewed.
              referrerPolicy="no-referrer"
              className="h-56 w-full border-0"
            />
          </div>
        )}
      </div>

      {lightbox.element}
    </article>
  );
}
