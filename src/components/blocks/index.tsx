"use client";

import Image from "next/image";
import Link from "next/link";
import { FiPlay, FiHeadphones, FiExternalLink, FiMapPin, FiUsers } from "react-icons/fi";
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

  const columnClass =
    config.columns === 2 ? "grid-cols-2" : config.columns === 4 ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className={`grid ${columnClass} gap-1.5`}>
      {photos.map((photo, index) => (
        <div
          key={`${photo.postId}-${index}`}
          className="relative aspect-square rounded overflow-hidden bg-black/40"
        >
          <Image
            src={photo.url}
            alt=""
            fill
            sizes="(max-width: 768px) 33vw, 16vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
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
