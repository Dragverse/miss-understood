"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FiEdit3, FiCheck, FiAlertCircle } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";

/** Bluesky rejects posts over 300 graphemes. */
const BLUESKY_LIMIT = 300;
const NOTE_LIMIT = 3000;

/**
 * Quick note composer.
 *
 * A note is a short written thought that lands on the creator's board. It is
 * stored as a normal `posts` row with no media, so it reuses /api/posts/create
 * and, with the toggle on, the existing Bluesky crosspost path.
 */
export function NoteComposer({ onPosted }: { onPosted?: () => void }) {
  const { authenticated, getAccessToken } = usePrivy();
  const [body, setBody] = useState("");
  const [toBluesky, setToBluesky] = useState(false);
  const [hasBluesky, setHasBluesky] = useState(false);
  const [status, setStatus] = useState<"idle" | "posting" | "posted">("idle");
  const [error, setError] = useState<string | null>(null);

  // Only offer the Bluesky toggle to creators who've actually connected it.
  // Same source of truth as the feed composer, so the two never disagree.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const response = await fetch("/api/user/crosspost-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled || !data.success) return;

        setHasBluesky(!!data.connected?.bluesky);
        // Respect the creator's saved crosspost preference as the default.
        setToBluesky(!!(data.settings?.bluesky && data.connected?.bluesky));
      } catch (err) {
        console.error("[NoteComposer] Failed to load crosspost settings:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  const trimmed = body.trim();
  const tooLongForBluesky = toBluesky && trimmed.length > BLUESKY_LIMIT;
  const canPost = trimmed.length > 0 && trimmed.length <= NOTE_LIMIT && !tooLongForBluesky;

  async function post() {
    if (!canPost) return;
    setStatus("posting");
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/posts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          textContent: trimmed,
          mediaUrls: [],
          visibility: "public",
          platforms: { dragverse: true, bluesky: toBluesky },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't post your note");

      // Dragverse saved it even if the crosspost failed — say so rather than
      // reporting a blanket success or a blanket failure.
      if (toBluesky && data.crosspost?.bluesky && !data.crosspost.bluesky.success) {
        setError(`Note saved, but Bluesky rejected it: ${data.crosspost.bluesky.error ?? "unknown error"}`);
      }

      setBody("");
      setStatus("posted");
      onPosted?.();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post your note");
      setStatus("idle");
    }
  }

  if (!authenticated) return null;

  const counterLimit = toBluesky ? BLUESKY_LIMIT : NOTE_LIMIT;
  const remaining = counterLimit - trimmed.length;

  return (
    <div className="rounded-xl border border-[#2f2942] bg-[#1a0b2e] p-4">
      <div className="flex items-center gap-2 mb-3">
        <FiEdit3 aria-hidden="true" size={16} className="text-[#EB83EA]" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Quick note</h3>
      </div>

      <label htmlFor="note-body" className="sr-only">
        Write a note
      </label>
      <textarea
        id="note-body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void post();
        }}
        placeholder="A feeling, a thought, what you're working on…"
        className="w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 resize-y focus:border-[#EB83EA] focus:outline-none transition-colors"
      />

      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        {hasBluesky ? (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={toBluesky}
              onChange={(e) => setToBluesky(e.target.checked)}
              className="accent-[#EB83EA]"
            />
            <SiBluesky aria-hidden="true" size={14} className="text-[#0085ff]" />
            <span className="text-gray-300">Also post to Bluesky</span>
          </label>
        ) : (
          <span className="text-xs text-gray-500">Connect Bluesky in settings to share notes there.</span>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <span
            className={`text-xs tabular-nums ${
              remaining < 0 ? "text-red-400" : remaining < 40 ? "text-amber-400" : "text-gray-500"
            }`}
          >
            {remaining}
          </span>
          <button
            type="button"
            onClick={() => void post()}
            disabled={!canPost || status === "posting"}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#EB83EA] text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "posting" ? "Posting…" : status === "posted" ? "Posted" : "Post note"}
          </button>
        </div>
      </div>

      {tooLongForBluesky && (
        <p className="flex items-center gap-1.5 mt-2 text-xs text-amber-400">
          <FiAlertCircle aria-hidden="true" size={12} />
          Bluesky caps posts at {BLUESKY_LIMIT} characters. Shorten it, or turn the toggle off.
        </p>
      )}

      {status === "posted" && !error && (
        <p className="flex items-center gap-1.5 mt-2 text-xs text-green-400">
          <FiCheck aria-hidden="true" size={12} />
          Added to your board.
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
          <FiAlertCircle aria-hidden="true" size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
