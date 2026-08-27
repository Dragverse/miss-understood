"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import {
  FiPlay,
  FiPause,
  FiHeadphones,
  FiExternalLink,
  FiMapPin,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { BlockEmpty } from "./block-shell";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import { useOptionalAudioPlayer, type AudioTrack } from "@/contexts/AudioPlayerContext";
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
// Video showcase
// ============================================

export function VideoShowcaseBlock({ config, content }: BlockViewProps<"video_showcase">) {
  const videos = orderByPinned(content.videos, config.pinnedVideoIds).slice(0, config.limit);

  if (videos.length === 0) return <BlockEmpty message="No videos yet." />;

  // Hero: one video carries the block. Explicit pick wins, then the first
  // pinned one, then the newest — so the block is never empty just because
  // the featured video was deleted.
  if (config.layout === "hero") {
    const featured =
      videos.find((v) => v.id === config.featuredVideoId) ?? videos[0];
    return <VideoTile video={featured} showTitle={config.showTitles} size="hero" />;
  }

  if (config.layout === "list") {
    return (
      <ul className="space-y-2">
        {videos.map((video) => (
          <li key={video.id}>
            <Link
              href={`/watch/${video.id}`}
              className="flex items-center gap-3 group rounded-2xl p-2 -m-0.5 hover:bg-white/5 transition-colors"
            >
              <div className="relative w-24 aspect-video rounded-xl overflow-hidden flex-shrink-0 border border-[#2f2942]/60 bg-[#0f071a]">
                <Image
                  src={getSafeThumbnail(video.thumbnail)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <span className="text-sm font-medium line-clamp-2 group-hover:text-[color:var(--board-accent,var(--color-dragverse-primary))] transition-colors">
                {video.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (config.layout === "slider") {
    return (
      <MediaSlider perView={config.perView} count={videos.length} label="videos">
        {videos.map((video) => (
          <div key={video.id} className="keen-slider__slide">
            <VideoTile video={video} showTitle={config.showTitles} size="slide" />
          </div>
        ))}
      </MediaSlider>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {videos.map((video) => (
        <VideoTile key={video.id} video={video} showTitle={config.showTitles} size="grid" />
      ))}
    </div>
  );
}

/** One video thumbnail linking to the player. Shared by every layout. */
function VideoTile({
  video,
  showTitle,
  size,
}: {
  video: Video;
  showTitle: boolean;
  size: "hero" | "grid" | "slide";
}) {
  return (
    <Link href={`/watch/${video.id}`} className="group block">
      <div className="relative aspect-video rounded-[20px] overflow-hidden border-2 border-[#2f2942]/60 group-hover:border-[#2f2942] bg-[#0f071a] shadow-lg transition-all">
        <Image
          src={getSafeThumbnail(video.thumbnail)}
          alt=""
          fill
          sizes={size === "hero" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="rounded-full bg-black/70 backdrop-blur-sm border border-white/10 p-3.5">
            <FiPlay aria-hidden="true" size={size === "hero" ? 24 : 18} />
          </span>
        </div>
      </div>
      {showTitle && (
        <p
          className={`mt-2 line-clamp-2 ${
            size === "hero" ? "text-base font-bold leading-snug" : "text-xs font-medium"
          }`}
        >
          {video.title}
        </p>
      )}
    </Link>
  );
}


// ============================================
// Gallery
// ============================================

export function GalleryBlock({ config, content }: BlockViewProps<"gallery">) {
  // Curated uploads win outright. The post-derived fallback keeps galleries
  // working on boards that predate uploading.
  const curated = config.images ?? [];
  const photos =
    curated.length > 0
      ? curated.map((image, index) => ({ url: image.url, caption: image.caption, key: `c${index}` }))
      : content.posts
          .filter((post) => (post.media_urls?.length ?? 0) > 0)
          .filter((post) => !config.tag || post.tags?.includes(config.tag))
          .flatMap((post) =>
            (post.media_urls ?? []).map((url, index) => ({
              url,
              caption: undefined as string | undefined,
              key: `${post.id}-${index}`,
            }))
          );

  const shown = photos.slice(0, config.limit);

  if (shown.length === 0) return <BlockEmpty message="No photos yet." />;

  // One photo — whether that's all there is, or the creator chose `single` —
  // renders full-width at its natural proportions. A lone photo is a
  // statement, not a cropped tile.
  if (config.layout === "single" || shown.length === 1) {
    const photo = shown[0];
    return (
      <figure className="m-0">
        <div className="relative w-full rounded-[20px] overflow-hidden border-2 border-[#2f2942]/60 bg-[#0f071a] shadow-lg">
          <Image
            src={photo.url}
            alt={photo.caption ?? ""}
            width={1200}
            height={1200}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="w-full h-auto object-contain"
          />
        </div>
        {config.showCaptions && photo.caption && (
          <figcaption className="mt-1.5 text-xs text-white/60">{photo.caption}</figcaption>
        )}
      </figure>
    );
  }

  if (config.layout === "grid") {
    const columnClass =
      config.columns === 2 ? "grid-cols-2" : config.columns === 4 ? "grid-cols-4" : "grid-cols-3";
    return (
      <div className={`grid ${columnClass} gap-2.5`}>
        {shown.map((photo) => (
          <div
            key={photo.key}
            className="group relative aspect-square rounded-[20px] overflow-hidden border-2 border-[#2f2942]/60 hover:border-[#2f2942] bg-[#0f071a] shadow-lg transition-all"
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? ""}
              fill
              sizes="(max-width: 768px) 33vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <MediaSlider perView={config.perView} count={shown.length} label="photos">
      {shown.map((photo) => (
        <figure key={photo.key} className="keen-slider__slide m-0 group">
          <div className="relative aspect-square rounded-[20px] overflow-hidden border-2 border-[#2f2942]/60 group-hover:border-[#2f2942] bg-[#0f071a] shadow-lg transition-all">
            <Image
              src={photo.url}
              alt={photo.caption ?? ""}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          {config.showCaptions && photo.caption && (
            <figcaption className="mt-1 text-[11px] text-white/60 line-clamp-2">
              {photo.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </MediaSlider>
  );
}

/**
 * Horizontal slider shared by the photo and video galleries.
 *
 * Children must each carry `keen-slider__slide`. Arrows and dots only appear
 * when there is actually something to scroll to.
 */
function MediaSlider({
  perView,
  count,
  label,
  children,
}: {
  perView: number;
  count: number;
  label: string;
  children: React.ReactNode;
}) {
  // Never ask the slider to show more slides than exist, which would leave a
  // gap and disable dragging.
  const slidesPerView = Math.min(perView, count);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    slides: { perView: slidesPerView, spacing: 10 },
    slideChanged: (slider) => setCurrent(slider.track.details.rel),
    created: () => setReady(true),
  });

  const maxIndex = Math.max(0, count - slidesPerView);

  return (
    <div className="relative group/slider">
      <div ref={sliderRef} className="keen-slider">
        {children}
      </div>

      {ready && count > slidesPerView && (
        <>
          <SliderArrow
            side="left"
            label={`Previous ${label}`}
            disabled={current === 0}
            onClick={() => instanceRef.current?.prev()}
          />
          <SliderArrow
            side="right"
            label={`Next ${label}`}
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
  label,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = side === "left" ? FiChevronLeft : FiChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-1" : "right-1"
      } p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 transition-opacity disabled:!opacity-0`}
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
    <ul className="space-y-2.5">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-2xl bg-white/[0.03] border border-[#2f2942]/60 px-3.5 py-3"
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

/**
 * The creator's tracks as a working player.
 *
 * Drives the app's existing global AudioPlayerContext rather than mounting its
 * own <audio>, so playback survives navigating away from the profile and can't
 * fight the persistent player for the same output.
 */
export function MusicBlock({ config, content }: BlockViewProps<"music">) {
  const tracks = orderByPinned(content.audio, config.pinnedTrackIds).slice(0, config.limit);
  const player = useOptionalAudioPlayer();

  if (tracks.length === 0) return <BlockEmpty message="No tracks yet." />;

  const playlist: AudioTrack[] = tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: content.creator.displayName,
    thumbnail: track.thumbnail || "",
    audioUrl: track.playbackUrl,
    duration: track.duration,
    type: "uploaded",
    creatorDid: content.creator.did,
    contentType: track.contentType,
  }));

  const currentId = player?.currentTrack?.id;

  return (
    <ol className="space-y-1.5">
      {tracks.map((track, index) => {
        const isCurrent = currentId === track.id;
        const isPlaying = isCurrent && !!player?.isPlaying;

        return (
          <li key={track.id}>
            <div
              className={`flex items-center gap-3 py-2.5 px-3 rounded-2xl transition-colors ${
                isCurrent ? "bg-white/[0.07]" : "hover:bg-white/5"
              }`}
            >
              {/* Without the provider (or a playable URL) fall back to the
                  dedicated listen page rather than showing a dead button. */}
              {player && track.playbackUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrent) player.togglePlayPause();
                    else player.playTrack(playlist[index], playlist);
                  }}
                  aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="flex-shrink-0 w-9 h-9 rounded-full grid place-items-center bg-[color:var(--board-accent,var(--color-dragverse-primary))] text-[#12061c] hover:opacity-90 transition-opacity"
                >
                  {isPlaying ? <FiPause size={15} /> : <FiPlay size={15} />}
                </button>
              ) : (
                <Link
                  href={`/listen/${track.id}`}
                  aria-label={`Open ${track.title}`}
                  className="flex-shrink-0 w-9 h-9 rounded-full grid place-items-center bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <FiHeadphones size={15} />
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium truncate ${
                    isCurrent ? "text-[color:var(--board-accent,var(--color-dragverse-primary))]" : ""
                  }`}
                >
                  {track.title}
                </p>
                {isCurrent && player ? (
                  <TrackProgress
                    currentTime={player.currentTime}
                    duration={player.duration || track.duration || 0}
                  />
                ) : (
                  track.duration > 0 && (
                    <p className="text-[11px] text-white/40 tabular-nums">
                      {formatDuration(track.duration)}
                    </p>
                  )
                )}
              </div>

              <Link
                href={`/listen/${track.id}`}
                aria-label={`Track page for ${track.title}`}
                className="flex-shrink-0 p-1.5 rounded-full text-white/35 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiExternalLink size={13} />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Elapsed bar for the track currently playing. */
function TrackProgress({ currentTime, duration }: { currentTime: number; duration: number }) {
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="mt-1">
      <div
        className="h-0.5 rounded-full bg-white/15 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[color:var(--board-accent,var(--color-dragverse-primary))] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-white/40 tabular-nums">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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
          className="flex items-center justify-between gap-2 w-full px-4 py-3 rounded-2xl text-sm font-bold border-2 border-[#2f2942]/60 hover:border-[color:var(--board-accent,var(--color-dragverse-primary))] hover:bg-white/5 transition-all"
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
