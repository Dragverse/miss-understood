"use client";

import type { ReactNode } from "react";
import { FiLock, FiEye, FiEyeOff, FiTrash2, FiArrowUp, FiArrowDown, FiColumns } from "react-icons/fi";
import { cardStyleClasses } from "@/lib/blocks/theme";
import type { BoardTheme, ViewerBlock } from "@/lib/blocks/types";

interface BlockShellProps {
  title: string;
  theme: BoardTheme | null;
  children: ReactNode;
  /** Owner-only controls; omitted entirely for visitors. */
  editing?: BlockEditControls;
  visibility?: ViewerBlock["visibility"];
  hidden?: boolean;
}

export interface BlockEditControls {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSwapColumn: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * Card wrapper shared by every block. Owns the heading, the theme's card
 * treatment, and the owner's edit affordances so individual blocks only ever
 * describe their own content.
 */
export function BlockShell({
  title,
  theme,
  children,
  editing,
  visibility = "public",
  hidden = false,
}: BlockShellProps) {
  return (
    <section
      className={`rounded-xl overflow-hidden ${cardStyleClasses(theme?.cardStyle)} ${
        hidden ? "opacity-50" : ""
      }`}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[color:var(--color-border-dragverse)]">
        <h2
          className="text-sm font-semibold uppercase tracking-wide truncate"
          style={{ fontFamily: "var(--board-font-display)" }}
        >
          {title}
        </h2>

        <div className="flex items-center gap-1 flex-shrink-0">
          {visibility !== "public" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10"
              title={`Visible to ${visibility}`}
            >
              <FiLock aria-hidden="true" size={10} />
              {visibility === "subscribers" ? "Subscribers" : visibility}
            </span>
          )}

          {editing && (
            <>
              <IconButton
                label="Move block up"
                onClick={editing.onMoveUp}
                disabled={!editing.canMoveUp}
              >
                <FiArrowUp size={14} />
              </IconButton>
              <IconButton
                label="Move block down"
                onClick={editing.onMoveDown}
                disabled={!editing.canMoveDown}
              >
                <FiArrowDown size={14} />
              </IconButton>
              <IconButton label="Move to other column" onClick={editing.onSwapColumn}>
                <FiColumns size={14} />
              </IconButton>
              <IconButton
                label={hidden ? "Show block" : "Hide block"}
                onClick={editing.onToggleHidden}
              >
                {hidden ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </IconButton>
              <IconButton label="Delete block" onClick={editing.onDelete} destructive>
                <FiTrash2 size={14} />
              </IconButton>
            </>
          )}
        </div>
      </header>

      <div className="p-4" style={{ fontFamily: "var(--board-font-body)" }}>
        {children}
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        destructive ? "hover:bg-red-500/20 hover:text-red-400" : "hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * What a visitor sees in place of a gated block.
 *
 * Deliberately a teaser rather than nothing: a block that simply vanishes
 * tells a visitor there is nothing here, which is the opposite of true and
 * removes the only reason they'd subscribe.
 */
export function LockedBlock({
  title,
  reason,
  theme,
  onSubscribe,
}: {
  title: string;
  reason: "subscribers" | "followers-only";
  theme: BoardTheme | null;
  onSubscribe?: () => void;
}) {
  const copy =
    reason === "subscribers"
      ? { line: "This is for subscribers.", cta: "Subscribe to see it" }
      : { line: "This is for followers.", cta: "Follow to see it" };

  return (
    <BlockShell title={title} theme={theme} visibility={reason}>
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <FiLock aria-hidden="true" size={18} />
        </div>
        <p className="text-sm text-white/70">{copy.line}</p>
        {onSubscribe && (
          <button
            type="button"
            onClick={onSubscribe}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[color:var(--board-accent,var(--color-dragverse-primary))] text-black hover:opacity-90 transition-opacity"
          >
            {copy.cta}
          </button>
        )}
      </div>
    </BlockShell>
  );
}

/** Consistent empty state so a sparse board still reads as intentional. */
export function BlockEmpty({ message }: { message: string }) {
  return <p className="text-sm text-white/50 py-2">{message}</p>;
}
