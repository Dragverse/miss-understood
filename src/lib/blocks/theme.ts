/**
 * Creator Board — theming.
 *
 * Deliberately NOT raw CSS. A theme is a small set of constrained values that
 * map onto the CSS custom properties globals.css already declares under
 * `@theme inline`, scoped to the board root. That keeps the injection surface
 * at zero and guarantees every profile stays legible.
 */

import type { CSSProperties } from "react";
import type { BoardTheme } from "./types";

/** Board backgrounds default to the app's dark surface. */
const DEFAULT_BOARD_BG = "var(--color-bg-dark)";

/** Curated gradients. Creators pick a name; they never supply CSS. */
export const GRADIENT_PRESETS: Record<string, string> = {
  sunset: "linear-gradient(160deg, #EB83EA 0%, #7c3aed 55%, #0f071a 100%)",
  lagoon: "linear-gradient(160deg, #00f2ea 0%, #0085ff 50%, #0f071a 100%)",
  ember: "linear-gradient(160deg, #ff9a3c 0%, #E748E6 55%, #0f071a 100%)",
  moss: "linear-gradient(160deg, #7ee787 0%, #2f8f5b 50%, #0f071a 100%)",
  velvet: "linear-gradient(160deg, #7c3aed 0%, #2f2942 60%, #0f071a 100%)",
  noir: "linear-gradient(160deg, #2f2942 0%, #0f071a 100%)",
};

/** Curated font pairings. Never an arbitrary font URL. */
export const FONT_PAIRS: Record<string, { display: string; body: string }> = {
  default: { display: "var(--font-sans)", body: "var(--font-sans)" },
  mono: { display: "var(--font-mono)", body: "var(--font-sans)" },
  serif: { display: "Georgia, 'Times New Roman', serif", body: "var(--font-sans)" },
  condensed: { display: "'Arial Narrow', Impact, sans-serif", body: "var(--font-sans)" },
};

// ============================================
// Colour maths — WCAG relative luminance
// ============================================

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;

  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Accent colours are used for links and small UI text on the dark board
 * surface, so they need to clear WCAG AA for normal text.
 */
const MIN_ACCENT_CONTRAST = 4.5;
const BOARD_SURFACE = "#0f071a"; // --color-bg-dark

/**
 * Nudge an accent colour until it is readable on the board surface.
 *
 * Returns the original when it already passes. Creators get a slightly
 * brightened shade rather than a validation error — rejecting someone's colour
 * choice outright is a bad experience, and silently shipping unreadable text
 * is worse.
 */
export function ensureReadableAccent(
  hex: string,
  surface: string = BOARD_SURFACE
): { color: string; adjusted: boolean } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { color: hex, adjusted: false };

  const initial = contrastRatio(hex, surface);
  if (initial === null || initial >= MIN_ACCENT_CONTRAST) {
    return { color: hex, adjusted: false };
  }

  // Walk toward white (the surface is dark) in small steps. Bounded at 24
  // iterations so a pathological input can't spin.
  let [r, g, b] = rgb;
  for (let step = 0; step < 24; step++) {
    r += (255 - r) * 0.08;
    g += (255 - g) * 0.08;
    b += (255 - b) * 0.08;

    const candidate = rgbToHex(r, g, b);
    const ratio = contrastRatio(candidate, surface);
    if (ratio !== null && ratio >= MIN_ACCENT_CONTRAST) {
      return { color: candidate, adjusted: true };
    }
  }

  return { color: "#ffffff", adjusted: true };
}

// ============================================
// Background URL allowlist
// ============================================

/**
 * Background images must live on our own Supabase storage.
 *
 * An arbitrary remote URL leaks every visitor's IP to a third party and lets
 * the image be swapped for something else after a moderator has approved it.
 */
export function isAllowedBackgroundUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;

    const allowedHost = new URL(supabaseUrl).hostname.toLowerCase();
    return parsed.hostname.toLowerCase() === allowedHost;
  } catch {
    return false;
  }
}

// ============================================
// Theme → CSS custom properties
// ============================================

function backgroundFor(theme: BoardTheme | null): string {
  if (!theme || theme.backgroundKind === "default") return DEFAULT_BOARD_BG;

  switch (theme.backgroundKind) {
    case "color":
      return theme.backgroundValue ?? DEFAULT_BOARD_BG;
    case "gradient":
      return GRADIENT_PRESETS[theme.backgroundValue ?? ""] ?? DEFAULT_BOARD_BG;
    case "image":
      // Re-checked at render: a value that predates the allowlist, or was
      // written directly to the database, must not reach the browser.
      return theme.backgroundValue && isAllowedBackgroundUrl(theme.backgroundValue)
        ? `url("${encodeURI(theme.backgroundValue)}")`
        : DEFAULT_BOARD_BG;
    default:
      return DEFAULT_BOARD_BG;
  }
}

/**
 * Build the inline custom-property overrides for a board root.
 *
 * These are scoped to `.creator-board`. Site navigation deliberately sits
 * outside that element, so no theme can make the app unnavigable.
 */
export function themeToCssVars(theme: BoardTheme | null): CSSProperties {
  const fonts = FONT_PAIRS[theme?.fontPair ?? "default"] ?? FONT_PAIRS.default;
  const vars: Record<string, string> = {
    "--board-bg": backgroundFor(theme),
    "--board-font-display": fonts.display,
    "--board-font-body": fonts.body,
    "--board-bg-repeat": theme?.backgroundTile ? "repeat" : "no-repeat",
    "--board-bg-size": theme?.backgroundTile ? "auto" : "cover",
  };

  if (theme?.accentColor) {
    // Re-run the contrast guard on read. Themes can predate a rule change or
    // be written straight to the database, and the renderer is the last place
    // that can still catch it.
    const { color } = ensureReadableAccent(theme.accentColor);
    vars["--color-dragverse-primary"] = color;
    vars["--board-accent"] = color;
  }

  return vars as CSSProperties;
}

/** Card surface treatment, applied per block. */
export function cardStyleClasses(style: BoardTheme["cardStyle"] | undefined): string {
  switch (style) {
    case "glass":
      return "bg-white/5 backdrop-blur-md border border-white/10";
    case "outline":
      return "bg-transparent border border-[color:var(--color-border-dragverse)]";
    case "sticker":
      return "bg-[color:var(--color-bg-card)] border-2 border-[color:var(--board-accent,var(--color-dragverse-primary))] shadow-[4px_4px_0_0_var(--board-accent,var(--color-dragverse-primary))]";
    case "solid":
    default:
      return "bg-[color:var(--color-bg-card)] border border-[color:var(--color-border-dragverse)]";
  }
}
