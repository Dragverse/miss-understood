"use client";

import { useCallback, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { BLOCK_REGISTRY, addableBlockTypes, blockLabel } from "@/lib/blocks/registry";
import { BlockShell, LockedBlock, type BlockEditControls } from "@/components/blocks/block-shell";
import type { BlockContent } from "@/components/blocks";
import { themeToCssVars } from "@/lib/blocks/theme";
import type { Board, BlockType, ColumnIndex, ViewerBlock } from "@/lib/blocks/types";

interface CreatorBoardProps {
  board: Board;
  content: BlockContent;
  /** Owner-only. Omit to render read-only, even when board.isOwner is true. */
  onMutate?: BoardMutations;
}

export interface BoardMutations {
  reorder: (blocks: Array<{ id: string; columnIndex: ColumnIndex; position: number }>) => Promise<void>;
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  add: (type: BlockType) => Promise<void>;
}

/**
 * The two-column board.
 *
 * Desktop renders two independent masonry columns. Mobile collapses to a
 * single stack ordered by `position`, which is why position is global across
 * both columns rather than per-column — that ordering IS the mobile layout.
 */
export function CreatorBoard({ board, content, onMutate }: CreatorBoardProps) {
  const editable = board.isOwner && !!onMutate;
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(
    () => [...board.blocks].sort((a, b) => a.position - b.position),
    [board.blocks]
  );

  const [left, right] = useMemo(
    () => [ordered.filter((b) => b.columnIndex === 0), ordered.filter((b) => b.columnIndex === 1)],
    [ordered]
  );

  /**
   * Moving is expressed as a swap of adjacent positions within the same
   * column, then persisted as absolute positions for the whole board. Sending
   * the full ordering means a dropped request can't leave a half-reordered
   * board.
   */
  const move = useCallback(
    async (blockId: string, direction: -1 | 1) => {
      if (!onMutate || busy) return;

      const block = ordered.find((b) => b.id === blockId);
      if (!block) return;

      const column = ordered.filter((b) => b.columnIndex === block.columnIndex);
      const indexInColumn = column.findIndex((b) => b.id === blockId);
      const target = column[indexInColumn + direction];
      if (!target) return;

      const swapped = ordered.map((b) => {
        if (b.id === block.id) return { ...b, position: target.position };
        if (b.id === target.id) return { ...b, position: block.position };
        return b;
      });

      setBusy(true);
      try {
        await onMutate.reorder(
          swapped
            .sort((a, b) => a.position - b.position)
            .map((b, index) => ({ id: b.id, columnIndex: b.columnIndex, position: index }))
        );
      } finally {
        setBusy(false);
      }
    },
    [ordered, onMutate, busy]
  );

  const swapColumn = useCallback(
    async (blockId: string) => {
      if (!onMutate || busy) return;

      setBusy(true);
      try {
        await onMutate.reorder(
          ordered.map((b, index) => ({
            id: b.id,
            columnIndex: b.id === blockId ? ((b.columnIndex === 0 ? 1 : 0) as ColumnIndex) : b.columnIndex,
            position: index,
          }))
        );
      } finally {
        setBusy(false);
      }
    },
    [ordered, onMutate, busy]
  );

  const renderBlock = (block: ViewerBlock) => {
    const definition = BLOCK_REGISTRY[block.type];
    const title = blockLabel(block.type, block.title);

    if (block.locked) {
      return (
        <LockedBlock key={block.id} title={title} reason={block.lockReason} theme={board.theme} />
      );
    }

    if (!definition) {
      // A block type in the database with no registry entry — possible after a
      // rollback. Skip it rather than crashing the whole board.
      console.warn(`[Board] Unknown block type: ${block.type}`);
      return null;
    }

    const column = ordered.filter((b) => b.columnIndex === block.columnIndex);
    const indexInColumn = column.findIndex((b) => b.id === block.id);

    const editing: BlockEditControls | undefined =
      editable && onMutate
        ? {
            onMoveUp: () => void move(block.id, -1),
            onMoveDown: () => void move(block.id, 1),
            onSwapColumn: () => void swapColumn(block.id),
            onToggleHidden: () => void onMutate.setHidden(block.id, !block.hidden),
            onDelete: () => void onMutate.remove(block.id),
            canMoveUp: indexInColumn > 0,
            canMoveDown: indexInColumn < column.length - 1,
          }
        : undefined;

    const View = definition.view;

    return (
      <BlockShell
        key={block.id}
        title={title}
        theme={board.theme}
        editing={editing}
        visibility={block.visibility}
        hidden={block.hidden}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <View config={block.config as any} content={content} />
      </BlockShell>
    );
  };

  return (
    <div
      className="creator-board"
      style={{
        ...themeToCssVars(board.theme),
        background: "var(--board-bg)",
        backgroundSize: "var(--board-bg-size)",
        backgroundRepeat: "var(--board-bg-repeat)",
      }}
    >
      {/* Mobile: one stack, position order. Desktop: two masonry columns. */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        {ordered.map(renderBlock)}
        {editable && onMutate && <AddBlockButton onAdd={onMutate.add} busy={busy} />}
      </div>

      <div className="hidden md:grid grid-cols-2 gap-4 p-4 items-start">
        <div className="flex flex-col gap-4">{left.map(renderBlock)}</div>
        <div className="flex flex-col gap-4">
          {right.map(renderBlock)}
          {editable && onMutate && <AddBlockButton onAdd={onMutate.add} busy={busy} />}
        </div>
      </div>
    </div>
  );
}

function AddBlockButton({
  onAdd,
  busy,
}: {
  onAdd: (type: BlockType) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = addableBlockTypes();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border border-dashed border-[color:var(--color-border-dragverse)] text-sm text-white/60 hover:text-white hover:border-[color:var(--board-accent,var(--color-dragverse-primary))] transition-colors disabled:opacity-50"
      >
        <FiPlus aria-hidden="true" size={16} />
        Add a block
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--color-border-dragverse)] bg-[color:var(--color-bg-card)] p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-white/50">Add a block</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-white/50 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <ul className="mt-1">
        {options.map((type) => {
          const definition = BLOCK_REGISTRY[type];
          const Icon = definition.icon;
          return (
            <li key={type}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await onAdd(type);
                  setOpen(false);
                }}
                className="flex items-start gap-3 w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <Icon aria-hidden="true" size={16} className="mt-0.5 flex-shrink-0 opacity-70" />
                <span>
                  <span className="block text-sm font-medium">{definition.label}</span>
                  <span className="block text-xs text-white/50">{definition.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
