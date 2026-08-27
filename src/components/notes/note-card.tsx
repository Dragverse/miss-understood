"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiLink, FiArrowUpRight } from "react-icons/fi";

/**
 * A note as stored in `posts`. Only the fields a card actually renders.
 *
 * Fields added by supabase-migration-note-fields.sql are optional so this
 * component works against rows written before that migration ran.
 */
export interface NoteCardData {
  id: string;
  title?: string | null;
  text_content?: string | null;
  media_urls?: string[] | null;
  link_url?: string | null;
  link_label?: string | null;
  expires_at?: string | null;
  note_style?: "card" | "quote" | null;
  created_at?: string;
  creator?: {
    handle?: string | null;
    display_name?: string | null;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
}

const CLAMP = 300;

/**
 * One note, used by the board's notes block, the profile Notes tab and the
 * feed. Three surfaces, one component — a note should look the same wherever
 * it turns up.
 */
export function NoteCard({
  note,
  showAuthor = false,
}: {
  note: NoteCardData;
  showAuthor?: boolean;
}) {
  const body = (note.text_content ?? "").trim();
  const image = note.media_urls?.[0];
  const expiry = expiresInLabel(note.expires_at);

  if (note.note_style === "quote") {
    return (
      <figure className="m-0 rounded-[28px] bg-[color:var(--color-card-pink-strong)] p-6 shadow-lg">
        {/* Large display type is why white clears contrast here — see the
            token comment in globals.css. Don't shrink this text. */}
        <blockquote className="font-heading text-2xl sm:text-3xl uppercase leading-[1.05] text-white">
          {body}
        </blockquote>
        {showAuthor && note.creator && (
          <figcaption className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/70">
            {authorName(note)}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <article className="rounded-[28px] overflow-hidden bg-[color:var(--color-card-pink)] text-[color:var(--color-card-ink)] shadow-lg">
      {image && (
        <div className="relative w-full aspect-[4/3] bg-black/20">
          <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          {expiry && (
            <span className="absolute top-3 right-3 rounded-lg bg-[color:var(--color-badge-green)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-card-ink)]">
              {expiry}
            </span>
          )}
        </div>
      )}

      <div className="p-5">
        {!image && expiry && (
          <span className="inline-block mb-2 rounded-lg bg-[color:var(--color-badge-green)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            {expiry}
          </span>
        )}

        {note.title && (
          <h3 className="font-heading text-xl sm:text-2xl uppercase leading-[0.95] tracking-tight mb-2">
            {note.title}
          </h3>
        )}

        {body && <NoteBody body={body} />}

        {/* First bare URL in the text gets a proper card. Suppressed when the
            note already has an explicit link button, so the same destination
            isn't offered twice. */}
        {!note.link_url && firstUrl(body) && <LinkPreviewCard url={firstUrl(body)!} />}

        {showAuthor && note.creator?.handle && (
          <Link
            href={`/u/${note.creator.handle}`}
            className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide opacity-60 hover:opacity-100 transition-opacity"
          >
            {authorName(note)}
          </Link>
        )}

        {note.link_url && (
          <a
            href={note.link_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 block w-full text-center rounded-2xl bg-[color:var(--color-action-yellow)] px-5 py-3 font-heading text-base uppercase tracking-tight text-[color:var(--color-card-ink)] hover:opacity-90 transition-opacity"
          >
            {note.link_label?.trim() || "Link"}
          </a>
        )}
      </div>
    </article>
  );
}

function NoteBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > CLAMP;
  const shown = isLong && !expanded ? `${body.slice(0, CLAMP).trimEnd()}…` : body;

  return (
    <>
      {/* Linkified into React elements, never dangerouslySetInnerHTML — the
          URL text itself is still untrusted input. */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{linkify(shown)}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold opacity-60 hover:opacity-100 transition-opacity"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </>
  );
}

function authorName(note: NoteCardData): string {
  const creator = note.creator;
  return creator?.displayName || creator?.display_name || `@${creator?.handle ?? "unknown"}`;
}

/**
 * "Expires in 3 days" — only for notes that actually expire, and only while
 * the deadline is still ahead. An already-expired note shouldn't reach a card
 * (reads filter it out), but if one does, say nothing rather than lie.
 */
export function expiresInLabel(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;

  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;

  const days = Math.ceil(ms / 86_400_000);
  if (days > 30) return null; // too far out to be urgent
  if (days > 1) return `Expires in ${days} days`;

  const hours = Math.ceil(ms / 3_600_000);
  if (hours > 1) return `Expires in ${hours} hours`;
  return "Expires soon";
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** First http(s) URL in a string, or null. */
export function firstUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === "http:" || url.protocol === "https:" ? match[0] : null;
  } catch {
    return null;
  }
}

/** Host without www, for display. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Turn bare URLs in note text into anchors, leaving everything else as plain
 * text nodes. Returns React children, so nothing is ever parsed as HTML.
 */
function linkify(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, index) => {
    if (index % 2 === 0) return part;
    let safe = false;
    try {
      const { protocol } = new URL(part);
      safe = protocol === "http:" || protocol === "https:";
    } catch {
      safe = false;
    }
    if (!safe) return part;
    return (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 decoration-current/40 hover:decoration-current break-all"
      >
        {part}
      </a>
    );
  });
}

/**
 * A tappable card for a link mentioned in the note body.
 *
 * Shows the host rather than fetching a preview: server-side unfurling would
 * mean requesting arbitrary third-party URLs from our backend, which is an
 * SSRF surface and leaks that a Dragverse user is reading the link.
 */
function LinkPreviewCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-3 flex items-center gap-3 rounded-2xl bg-black/[0.07] hover:bg-black/[0.12] transition-colors p-3"
    >
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-[color:var(--color-action-yellow)] flex-shrink-0">
        <FiLink aria-hidden="true" size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold truncate">{hostOf(url)}</span>
        <span className="block text-xs opacity-60 truncate">{url}</span>
      </span>
      <FiArrowUpRight aria-hidden="true" size={16} className="flex-shrink-0 opacity-50" />
    </a>
  );
}
