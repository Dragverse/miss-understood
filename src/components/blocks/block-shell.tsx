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
      className={`rounded-[24px] overflow-hidden shadow-lg transition-all ${cardStyleClasses(
        theme?.cardStyle
      )} ${hidden ? "opacity-50" : ""}`}
      aria-label={title}
    >
      {/*
        Big display text on the accent colour.

        This is safe for free because the header text (#12061c) is almost
        exactly as dark as the board surface (#0f071a) that ensureReadableAccent
        already guarantees 4.5:1 against — so the two contrast checks are nearly
        the same computation, and passing one passes the other. Measured across
        the accent guard's whole output range the worst case is 4.49:1, which
        clears AA for large text (>=3:1) with room to spare; this heading is
        20px+ extrabold, so large-text is the applicable threshold.

        If this text is ever lightened, or the heading shrinks below 18.66px
        bold, that reasoning stops holding and needs rechecking.
      */}
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 bg-[color:var(--board-accent,var(--color-dragverse-primary))] text-[#12061c]">
        <h2
          className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight leading-none truncate"
          style={{ fontFamily: "var(--board-font-display)" }}
        >
          {title}
        </h2>

        <div className="flex items-center gap-1 flex-shrink-0">
          {visibility !== "public" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-bold px-2 py-1 rounded-full bg-black/25"
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

      <div className="p-5" style={{ fontFamily: "var(--board-font-body)" }}>
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
      // Sits on the accent-coloured header, so hovers darken rather than lighten.
      className={`p-1.5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        destructive ? "hover:bg-red-900/30 hover:text-red-900" : "hover:bg-black/15"
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
      <div className="flex flex-col items-center text-center gap-3 py-8 rounded-2xl border border-dashed border-[#2f2942]">
        <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center">
          <FiLock aria-hidden="true" size={20} />
        </div>
        <p className="text-base font-semibold text-white/80">{copy.line}</p>
        {onSubscribe && (
          <button
            type="button"
            onClick={onSubscribe}
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-[color:var(--board-accent,var(--color-dragverse-primary))] text-[#12061c] hover:opacity-90 transition-opacity"
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
  return <p className="text-sm text-white/45 py-3">{message}</p>;
}
