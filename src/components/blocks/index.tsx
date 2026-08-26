"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import {
  FiPlay,
  FiHeadphones,
  FiExternalLink,
  FiMapPin,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { BlockEmpty } from "./block-shell";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import type { Creator, Video } from "@/types";
import type {
  BlockConfigMap,
} from "@/lib/blocks/schemas";

/**
 * Content the board loads once and hands to every block, so twelve blocks
 * don't each issue their own request for the same creator's videos.
 * Blocks needing data nobody else uses (events, guestbook) fetch their own.
 */
export interface BlockContent {
  creator: Creator;
  videos: Video[];
  audio: Video[];
  posts: Array<{
    id: string;
    media_urls?: string[] | null;
    text_content?: string | null;
    tags?: string[] | null;
    created_at?: string;
  }>;
}

export interface BlockViewProps<T extends keyof BlockConfigMap = keyof BlockConfigMap> {
  config: BlockConfigMap[T];
  content: BlockContent;
}

// ============================================
// About
// ============================================

export function AboutBlock({ config, content }: BlockViewProps<"about">) {
  const { creator } = content;
  const facts: Array<[string, string | undefined]> = [
    [config.showPronouns ? "Pronouns" : "", config.pronouns],
    [config.showBasedIn ? "Based in" : "", config.basedIn],
    [config.showDragFamily ? "Drag family" : "", config.dragFamily],
  ];

  const shown = facts.filter(([label, value]) => label && value);

  if (!creator.description && shown.length === 0) {
    return <BlockEmpty message="Nothing here yet." />;
  }

  return (
    <div className="space-y-3">
      {creator.description && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{creator.description}</p>
      )}

      {shown.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {shown.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-white/50">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ============================================
// Video showcase
// ============================================

export function VideoShowcaseBlock({ config, content }: BlockViewProps<"video_showcase">) {
  const videos = orderByPinned(content.videos, config.pinnedVideoIds).slice(0, config.limit);

  if (videos.length === 0) return <BlockEmpty message="No videos yet." />;

  if (config.layout === "list") {
    return (
      <ul className="space-y-2">
        {videos.map((video) => (
          <li key={video.id}>
            <Link
              href={`/watch/${video.id}`}
              className="flex items-center gap-3 group rounded-lg p-1 -m-1 hover:bg-white/5 transition-colors"
            >
              <div className="relative w-24 aspect-video rounded overflow-hidden flex-shrink-0 bg-black/40">
                <Image
                  src={getSafeThumbnail(video.thumbnail)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <span className="text-sm line-clamp-2 group-hover:text-[color:var(--board-accent,var(--color-dragverse-primary))]">
                {video.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {videos.map((video) => (
        <Link key={video.id} href={`/watch/${video.id}`} className="group">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40">
            <Image
              src={getSafeThumbnail(video.thumbnail)}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
              <FiPlay aria-hidden="true" size={20} />
            </div>
          </div>
          <p className="mt-1.5 text-xs line-clamp-2">{video.title}</p>
        </Link>
      ))}
    </div>
  );
}

// ============================================
// Gallery
// ============================================

export function GalleryBlock({ config, content }: BlockViewProps<"gallery">) {
  const photos = content.posts
    .filter((post) => (post.media_urls?.length ?? 0) > 0)
    .filter((post) => !config.tag || post.tags?.includes(config.tag))
    .flatMap((post) => (post.media_urls ?? []).map((url) => ({ url, postId: post.id })))
    .slice(0, config.limit);

  if (photos.length === 0) return <BlockEmpty message="No photos yet." />;

  // A single image is shown full-width with its natural proportions rather
  // than cropped into a square slide — one photo is a statement, not a set.
  if (photos.length === 1) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden bg-black/40">
        <Image
          src={photos[0].url}
          alt=""
          width={1200}
          height={1200}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="w-full h-auto object-contain"
        />
      </div>
    );
  }

  if (config.layout === "grid") {
    const columnClass =
      config.columns === 2 ? "grid-cols-2" : config.columns === 4 ? "grid-cols-4" : "grid-cols-3";
    return (
      <div className={`grid ${columnClass} gap-1.5`}>
        {photos.map((photo, index) => (
          <div
            key={`${photo.postId}-${index}`}
            className="relative aspect-square rounded overflow-hidden bg-black/40"
          >
            <Image src={photo.url} alt="" fill sizes="(max-width: 768px) 33vw, 16vw" className="object-cover" />
          </div>
        ))}
      </div>
    );
  }

  return <GallerySlider photos={photos} perView={config.perView} />;
}

function GallerySlider({
  photos,
  perView,
}: {
  photos: Array<{ url: string; postId: string }>;
  perView: number;
}) {
  // Never ask the slider to show more slides than exist, which would leave a
  // gap and disable dragging.
  const slidesPerView = Math.min(perView, photos.length);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    slides: { perView: slidesPerView, spacing: 6 },
    slideChanged: (slider) => setCurrent(slider.track.details.rel),
    created: () => setReady(true),
  });

  const maxIndex = Math.max(0, photos.length - slidesPerView);

  return (
    <div className="relative group/gallery">
      <div ref={sliderRef} className="keen-slider rounded-lg overflow-hidden">
        {photos.map((photo, index) => (
          <div
            key={`${photo.postId}-${index}`}
            className="keen-slider__slide relative aspect-square bg-black/40"
          >
            <Image src={photo.url} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
          </div>
        ))}
      </div>

      {ready && photos.length > slidesPerView && (
        <>
          <SliderArrow
            side="left"
            disabled={current === 0}
            onClick={() => instanceRef.current?.prev()}
          />
          <SliderArrow
            side="right"
            disabled={current >= maxIndex}
            onClick={() => instanceRef.current?.next()}
          />
          <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
            {Array.from({ length: maxIndex + 1 }).map((_, index) => (
              <span
                key={index}
                className={`h-1 rounded-full transition-all ${
                  index === current
                    ? "w-4 bg-[color:var(--board-accent,var(--color-dragverse-primary))]"
                    : "w-1 bg-white/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SliderArrow({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = side === "left" ? FiChevronLeft : FiChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photos" : "Next photos"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-1" : "right-1"
      } p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 transition-opacity disabled:!opacity-0`}
    >
      <Icon aria-hidden="true" size={16} />
    </button>
  );
}

// ============================================
// Notes
// ============================================

/**
 * A creator's written notes — `posts` rows with text and no media. Written
 * from the dashboard composer, which can also send them to Bluesky.
 */
export function NotesBlock({ config, content }: BlockViewProps<"notes">) {
  const notes = content.posts
    .filter((post) => (post.text_content ?? "").trim().length > 0)
    .filter((post) => (post.media_urls?.length ?? 0) === 0)
    .slice(0, config.limit);

  if (notes.length === 0) return <BlockEmpty message="No notes yet." />;

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="pb-3 border-b border-[color:var(--color-border-dragverse)] last:border-0 last:pb-0"
        >
          <Note body={note.text_content ?? ""} createdAt={note.created_at} truncate={config.truncate} />
        </li>
      ))}
    </ul>
  );
}

const NOTE_CLAMP = 280;

function Note({
  body,
  createdAt,
  truncate,
}: {
  body: string;
  createdAt?: string;
  truncate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = truncate && body.length > NOTE_CLAMP;
  const shown = isLong && !expanded ? `${body.slice(0, NOTE_CLAMP).trimEnd()}…` : body;

  return (
    <>
      {/* Text node, never dangerouslySetInnerHTML — notes are plain text. */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-white/50 hover:text-white transition-colors"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
      {createdAt && (
        <time
          dateTime={createdAt}
          className="block mt-1.5 text-[11px] uppercase tracking-wide text-white/35"
        >
          {formatNoteDate(createdAt)}
        </time>
      )}
    </>
  );
}

function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ============================================
// Music
// ============================================

export function MusicBlock({ config, content }: BlockViewProps<"music">) {
  const tracks = orderByPinned(content.audio, config.pinnedTrackIds).slice(0, config.limit);

  if (tracks.length === 0) return <BlockEmpty message="No tracks yet." />;

  return (
    <ol className="space-y-1">
      {tracks.map((track, index) => (
        <li key={track.id}>
          <Link
            href={`/listen/${track.id}`}
            className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-white/5 transition-colors group"
          >
            <span className="text-xs text-white/40 w-5 text-right tabular-nums">{index + 1}</span>
            <FiHeadphones
              aria-hidden="true"
              size={14}
              className="text-white/40 group-hover:text-[color:var(--board-accent,var(--color-dragverse-primary))]"
            />
            <span className="text-sm truncate flex-1">{track.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// ============================================
// Links
// ============================================

export function LinksBlock({ config }: BlockViewProps<"links">) {
  if (config.links.length === 0) return <BlockEmpty message="No links yet." />;

  if (config.style === "list") {
    return (
      <ul className="space-y-1.5">
        {config.links.map((link) => (
          <li key={link.url}>
            <ExternalLinkRow label={link.label} url={link.url} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {config.links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium border border-[color:var(--color-border-dragverse)] hover:border-[color:var(--board-accent,var(--color-dragverse-primary))] hover:bg-white/5 transition-colors"
        >
          <span className="truncate">{link.label}</span>
          <FiExternalLink aria-hidden="true" size={14} className="flex-shrink-0 opacity-50" />
        </a>
      ))}
    </div>
  );
}

function ExternalLinkRow({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1.5 text-sm hover:text-[color:var(--board-accent,var(--color-dragverse-primary))] transition-colors"
    >
      {label}
      <FiExternalLink aria-hidden="true" size={12} className="opacity-50" />
    </a>
  );
}

// ============================================
// Text
// ============================================

export function TextBlock({ config }: BlockViewProps<"text">) {
  if (!config.body.trim()) return <BlockEmpty message="Nothing written yet." />;

  const alignClass =
    config.align === "center" ? "text-center" : config.align === "right" ? "text-right" : "text-left";

  // Rendered as a text node, never dangerouslySetInnerHTML. `body` is plain
  // text by schema; if rich text is ever wanted it needs a real sanitiser
  // rather than a relaxation here.
  return <p className={`text-sm leading-relaxed whitespace-pre-wrap ${alignClass}`}>{config.body}</p>;
}

// ============================================
// Booking
// ============================================

export function BookingBlock({ config, content }: BlockViewProps<"booking">) {
  const hasContact = config.email || config.bookingUrl;
  if (!hasContact && !config.ratesNote) {
    return <BlockEmpty message="No booking details yet." />;
  }

  return (
    <div className="space-y-3 text-sm">
      {config.travelsFrom && (
        <p className="flex items-center gap-1.5 text-white/70">
          <FiMapPin aria-hidden="true" size={14} />
          Based in {config.travelsFrom}
          {config.willTravel && " · will travel"}
        </p>
      )}

      {config.ratesNote && <p className="whitespace-pre-wrap">{config.ratesNote}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {config.bookingUrl && (
          <a
            href={config.bookingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="px-3 py-2 rounded-lg text-sm font-medium bg-[color:var(--board-accent,var(--color-dragverse-primary))] text-black hover:opacity-90 transition-opacity"
          >
            Book {content.creator.displayName}
          </a>
        )}
        {config.email && (
          <a
            href={`mailto:${config.email}`}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-[color:var(--color-border-dragverse)] hover:bg-white/5 transition-colors"
          >
            Email
          </a>
        )}
        {config.riderUrl && <ExternalLinkRow label="Tech rider" url={config.riderUrl} />}
      </div>
    </div>
  );
}

// ============================================
// Featured friends — placeholder until phase 4
// ============================================

export function FeaturedFriendsBlock() {
  return (
    <div className="flex items-center gap-2 text-sm text-white/50 py-2">
      <FiUsers aria-hidden="true" size={14} />
      Coming soon.
    </div>
  );
}

// ============================================
// Helpers
// ============================================

/**
 * Explicit pins first, in the creator's chosen order, then everything else
 * newest-first. Keeps a curated showcase stable as new uploads land.
 */
function orderByPinned(items: Video[], pinnedIds: string[]): Video[] {
  if (pinnedIds.length === 0) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const pinned = pinnedIds
    .map((id) => byId.get(id))
    .filter((item): item is Video => item !== undefined);

  const pinnedSet = new Set(pinned.map((item) => item.id));
  return [...pinned, ...items.filter((item) => !pinnedSet.has(item.id))];
}
