/**
 * Curated list of drag-related Bluesky accounts
 * These accounts will be fetched for video and photo content
 */

export interface CuratedBlueskyAccount {
  handle: string;
  displayName: string;
  description: string;
}

/**
 * Top drag Bluesky accounts curated by Dragverse
 *
 * To find accounts, search on Bluesky app or use:
 * https://bsky.app/profile/[handle]
 */
export const CURATED_DRAG_ACCOUNTS: CuratedBlueskyAccount[] = [
  {
    handle: "rupaulsdragrace.bsky.social",
    displayName: "RuPaul's Drag Race",
    description: "Official RuPaul's Drag Race account",
  },
  {
    handle: "wowpresents.bsky.social",
    displayName: "WOW Presents",
    description: "World of Wonder official account",
  },
  {
    handle: "trixiemattel.bsky.social",
    displayName: "Trixie Mattel",
    description: "Winner of All Stars 3, makeup mogul",
  },
  {
    handle: "katya.bsky.social",
    displayName: "Katya Zamolodchikova",
    description: "Russian bisexual transvestite hooker",
  },
  {
    handle: "bobthedragqueen.bsky.social",
    displayName: "Bob The Drag Queen",
    description: "Winner of Season 8, comedian, activist",
  },
  {
    handle: "biancadelrio.bsky.social",
    displayName: "Bianca Del Rio",
    description: "Winner of Season 6, insult comic queen",
  },
  {
    handle: "gottmik.bsky.social",
    displayName: "Gottmik",
    description: "First trans man on Drag Race",
  },
  {
    handle: "symone.bsky.social",
    displayName: "Symone",
    description: "Winner of Season 13",
  },
  {
    handle: "jinkxmonsoon.bsky.social",
    displayName: "Jinkx Monsoon",
    description: "Winner of Season 5 and All Stars 7",
  },
  {
    handle: "shangela.bsky.social",
    displayName: "Shangela",
    description: "Professional queen and All Stars legend",
  },
  {
    handle: "aquaria.bsky.social",
    displayName: "Aquaria",
    description: "Winner of Season 10, fashion icon",
  },
  {
    handle: "kimchi.bsky.social",
    displayName: "Kim Chi",
    description: "Fashion and beauty queen from Season 8",
  },
  {
    handle: "violetchachki.bsky.social",
    displayName: "Violet Chachki",
    description: "Winner of Season 7, burlesque performer",
  },
  {
    handle: "alaska.bsky.social",
    displayName: "Alaska Thunderfuck",
    description: "Winner of All Stars 2",
  },
  {
    handle: "drag.bsky.social",
    displayName: "Drag Community",
    description: "General drag community account",
  },
  {
    handle: "dragrace.bsky.social",
    displayName: "Drag Race Fans",
    description: "Drag Race fan community",
  },
  {
    handle: "queendom.bsky.social",
    displayName: "Queendom",
    description: "Drag and LGBTQ+ community",
  },
  {
    handle: "lgbtq.bsky.social",
    displayName: "LGBTQ+",
    description: "LGBTQ+ community content",
  },
];

/**
 * Get all curated drag account handles
 */
export function getDragAccountHandles(): string[] {
  return CURATED_DRAG_ACCOUNTS.map(account => account.handle);
}

/**
 * Find account info by handle
 */
export function getDragAccountInfo(handle: string): CuratedBlueskyAccount | undefined {
  return CURATED_DRAG_ACCOUNTS.find(account => account.handle === handle);
}
