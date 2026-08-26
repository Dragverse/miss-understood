"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { BoardMutations } from "@/components/profile/creator-board";
import type { Board, BlockType, ColumnIndex } from "@/lib/blocks/types";

interface UseBoardResult {
  board: Board | null;
  isLoading: boolean;
  error: string | null;
  mutations: BoardMutations;
  reload: () => Promise<void>;
}

/**
 * Load a creator's board and expose the owner mutations.
 *
 * Every mutation refetches rather than patching local state. Positions are
 * global across both columns, so a local patch would have to replicate the
 * server's reindexing to stay correct — refetching is a little slower and a
 * lot harder to get wrong.
 */
export function useBoard(handle: string | null): UseBoardResult {
  const { getAccessToken, authenticated } = usePrivy();
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!handle) {
      setBoard(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Anonymous visitors get the public board; a token additionally unlocks
      // whatever the viewer is entitled to.
      const headers: HeadersInit = {};
      if (authenticated) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/board/${encodeURIComponent(handle)}`, { headers });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to load board");
      setBoard(data.board as Board);
    } catch (err) {
      console.error("[useBoard] Load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load board");
      setBoard(null);
    } finally {
      setIsLoading(false);
    }
  }, [handle, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const authedFetch = useCallback(
    async (url: string, init: RequestInit) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");

      const response = await fetch(url, {
        ...init,
        headers: {
          ...init.headers,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [getAccessToken]
  );

  const mutations: BoardMutations = {
    reorder: useCallback(
      async (blocks: Array<{ id: string; columnIndex: ColumnIndex; position: number }>) => {
        await authedFetch("/api/board/reorder", {
          method: "POST",
          body: JSON.stringify({ blocks }),
        });
        await load();
      },
      [authedFetch, load]
    ),

    setHidden: useCallback(
      async (id: string, hidden: boolean) => {
        await authedFetch(`/api/board/blocks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ hidden }),
        });
        await load();
      },
      [authedFetch, load]
    ),

    remove: useCallback(
      async (id: string) => {
        await authedFetch(`/api/board/blocks/${id}`, { method: "DELETE" });
        await load();
      },
      [authedFetch, load]
    ),

    add: useCallback(
      async (type: BlockType) => {
        await authedFetch("/api/board/blocks", {
          method: "POST",
          body: JSON.stringify({ type, columnIndex: 0 }),
        });
        await load();
      },
      [authedFetch, load]
    ),
  };

  return { board, isLoading, error, mutations, reload: load };
}
