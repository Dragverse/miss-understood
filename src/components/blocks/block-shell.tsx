"use client";

import type { ReactNode } from "react";
import { FiLock, FiEye, FiEyeOff, FiTrash2, FiArrowUp, FiArrowDown, FiColumns } from "react-icons/fi";
import type { BoardTheme, ViewerBlock } from "@/lib/blocks/types";

/**
 * How a block's card is filled.
 *
 * - `pink`   filled card, dark ink. The default, and most of the board.
 * - `strong` deeper magenta with white display text. Quote cards.
 * - `dark`   dark surface. For blocks whose own content supplies the colour —
 *            the music track list, and anything media-led.
 * - `bare`   no card at all. Media-led blocks where the image IS the card, so
 *            padding and fill would only box it in.
 */
export type BlockVariant = "pink" | "strong" | "dark" | "bare";

interface BlockShellProps {
  title: string;
  theme: BoardTheme | null;
  children: ReactNode;
  variant?: BlockVariant;
  /** Hide the heading — for blocks that read better untitled. */
  hideTitle?: boolean;
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

function surfaceClasses(variant: BlockVariant): string {
  switch (variant) {
    case "strong":
      return "bg-[color:var(--color-card-pink-strong)] text-white";
    case "dark":
      return "bg-[color:var(--color-bg-card)] text-white border-2 border-[#2f2942]/60";
    case "bare":
      return "";
    case "pink":
    default:
      // --board-accent lets a themed board recolour every card at once; the
      // accent has already passed a readability check in lib/blocks/theme.
      return "bg-[color:var(--board-accent,var(--color-card-pink))] text-[color:var(--color-card-ink)]";
  }
}

/**
 * Card wrapper shared by every block.
 *
 * The title is large display type inside the card rather than a separate
 * header band — the card's fill is the only chrome it needs.
 */
export function BlockShell({
  title,
  children,
  variant = "pink",
  hideTitle = false,
  editing,
  visibility = "public",
  hidden = false,
}: BlockShellProps) {
  // `theme` stays on the props type: callers already pass it and the card
  // recolours through --board-accent in CSS rather than in JS.
  const bare = variant === "bare";

  return (
    <section
      className={`group/block relative rounded-[28px] overflow-hidden shadow-lg transition-all ${surfaceClasses(
        variant
      )} ${hidden ? "opacity-50" : ""}`}
      aria-label={title}
    >
      {/* Owner controls float over the card so they never displace the title.
          Revealed on hover, and on keyboard focus so they stay reachable. */}
      {(editing || visibility !== "public") && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition-opacity">
          {visibility !== "public" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded-full bg-black/70 text-white"
              title={`Visible to ${visibility}`}
            >
              <FiLock aria-hidden="true" size={10} />
              {visibility === "subscribers" ? "Subscribers" : visibility}
            </span>
          )}

          {editing && (
            <div className="flex items-center gap-0.5 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 p-0.5 text-white">
              <IconButton label="Move block up" onClick={editing.onMoveUp} disabled={!editing.canMoveUp}>
                <FiArrowUp size={13} />
              </IconButton>
              <IconButton
                label="Move block down"
                onClick={editing.onMoveDown}
                disabled={!editing.canMoveDown}
              >
                <FiArrowDown size={13} />
              </IconButton>
              <IconButton label="Move to other column" onClick={editing.onSwapColumn}>
                <FiColumns size={13} />
              </IconButton>
              <IconButton
                label={hidden ? "Show block" : "Hide block"}
                onClick={editing.onToggleHidden}
              >
                {hidden ? <FiEyeOff size={13} /> : <FiEye size={13} />}
              </IconButton>
              <IconButton label="Delete block" onClick={editing.onDelete} destructive>
                <FiTrash2 size={13} />
              </IconButton>
            </div>
          )}
        </div>
      )}

      <div className={bare ? "" : "p-5"} style={{ fontFamily: "var(--board-font-body)" }}>
        {!hideTitle && (
          <h2
            /* font-heading is the app's own display weight (1000 / 133% stretch).
               Deliberately NOT a Tailwind font-* weight, which would override it. */
            className="font-heading text-2xl sm:text-[28px] uppercase leading-[0.95] tracking-tight mb-3"
            style={{ fontFamily: "var(--board-font-display)" }}
          >
            {title}
          </h2>
        )}
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
      className={`p-1.5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        destructive ? "hover:bg-red-500/30 hover:text-red-300" : "hover:bg-white/20"
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
      ? { line: "For subscribers only", cta: "Subscribe to see it" }
      : { line: "For followers only", cta: "Follow to see it" };

  return (
    <BlockShell title={title} theme={theme} variant="bare" hideTitle visibility={reason}>
      <div className="relative min-h-[220px] grid place-items-center overflow-hidden">
        {/* Glow standing in for the blurred content underneath. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#7c3aed,transparent_60%),radial-gradient(circle_at_70%_60%,#EB83EA,transparent_60%)] blur-2xl opacity-80"
        />
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <p className="font-heading text-3xl uppercase leading-[0.95] text-[color:var(--color-action-yellow)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {copy.line}
          </p>
          {onSubscribe && (
            <button
              type="button"
              onClick={onSubscribe}
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-[color:var(--color-action-yellow)] text-[color:var(--color-card-ink)] hover:opacity-90 transition-opacity"
            >
              {copy.cta}
            </button>
          )}
        </div>
      </div>
    </BlockShell>
  );
}

/** Consistent empty state so a sparse board still reads as intentional. */
export function BlockEmpty({ message }: { message: string }) {
  return <p className="text-sm opacity-60 py-2">{message}</p>;
}

/** Full-width yellow action button, per the wireframe's LINK treatment. */
export function BlockLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="block w-full text-center px-5 py-3.5 rounded-2xl bg-[color:var(--color-action-yellow)] text-[color:var(--color-card-ink)] font-heading text-lg uppercase tracking-tight hover:opacity-90 transition-opacity"
    >
      {label}
    </a>
  );
}
