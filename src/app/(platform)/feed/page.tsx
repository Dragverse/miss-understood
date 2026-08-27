"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { FiEdit3, FiRefreshCw } from "react-icons/fi";
import { useAuthUser } from "@/lib/privy/hooks";
import { PostComposer } from "@/components/posts/post-composer";
import { FeedRightSidebar } from "@/components/feed/feed-right-sidebar";
import { CardSkeleton } from "@/components/shared";
import { NoteCard, type NoteCardData } from "@/components/notes/note-card";

/**
 * The notes gallery.
 *
 * Every public Dragverse note in the same cards the profile boards use — a
 * community wall rather than a timeline. Bluesky and YouTube are deliberately
 * no longer merged in here: Dragverse is a place creators own, not a reader
 * for other networks. Outbound crossposting stays, via the composer, so notes
 * still reach Bluesky for findability.
 */
function FeedContent() {
  const { isAuthenticated } = useAuthUser();
  const [notes, setNotes] = useState<NoteCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Already filters to public, honours scheduled_at, and drops expired notes.
      const response = await fetch("/api/posts/feed?limit=60");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load notes");
      setNotes(data.posts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load notes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex gap-8">
        <div className="flex-1 min-w-0">
          <header className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-tight leading-none">
                Notes
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                What the Dragverse community is thinking right now
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              aria-label="Refresh notes"
              className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
            </button>
          </header>

          {isAuthenticated && (
            <div className="mb-6">
              <PostComposer onPostCreated={() => void load(true)} />
            </div>
          )}

          {error && (
            <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 grid place-items-center mx-auto mb-4">
                <FiEdit3 className="w-9 h-9 text-gray-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">No notes yet</h2>
              <p className="text-gray-400">
                {isAuthenticated
                  ? "Be the first — write something above."
                  : "Sign in to write the first one."}
              </p>
            </div>
          ) : (
            /* Masonry: notes vary a lot in height, and a row grid would leave
               big gaps under the short ones. */
            <div className="columns-1 sm:columns-2 xl:columns-3 gap-4 [column-fill:_balance]">
              {notes.map((note) => (
                <div key={note.id} className="mb-4 break-inside-avoid">
                  <NoteCard note={note} showAuthor />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="hidden xl:block w-80 flex-shrink-0">
          <FeedRightSidebar />
        </aside>
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}
