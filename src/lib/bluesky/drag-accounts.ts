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
    handle: "willam.bsky.social",
    displayName: "Willam",
    description: "Season 4 queen, actor, YouTuber",
  },
  {
    handle: "adore.bsky.social",
    displayName: "Adore Delano",
    description: "Season 6 and All Stars 2, singer",
  },
  {
    handle: "bendelacreme.bsky.social",
    displayName: "BenDeLaCreme",
    description: "Season 6 and All Stars 3, Seattle legend",
  },
  {
    handle: "manila.bsky.social",
    displayName: "Manila Luzon",
    description: "All Stars 1 and 4, fashion icon",
  },
  {
    handle: "latrice.bsky.social",
    displayName: "Latrice Royale",
    description: "Season 4 and All Stars, large and in charge",
  },
  {
    handle: "alyssa.bsky.social",
    displayName: "Alyssa Edwards",
    description: "Season 5 and All Stars 2, dance teacher extraordinaire",
  },
  {
    handle: "vanjie.bsky.social",
    displayName: "Vanessa Vanjie Mateo",
    description: "Season 10 and 11, Miss Vanjie herself",
  },
  {
    handle: "naomi.bsky.social",
    displayName: "Naomi Smalls",
    description: "Season 8 and All Stars 4, legs for days",
  },
  {
    handle: "monique.bsky.social",
    displayName: "Monique Heart",
    description: "Season 10 and All Stars 4, stunning queen",
  },
  {
    handle: "shea.bsky.social",
    displayName: "Shea Couleé",
    description: "Winner of All Stars 5, Chicago excellence",
  },
  {
    handle: "monet.bsky.social",
    displayName: "Monét X Change",
    description: "Winner of All Stars 4, sponge queen",
  },
  {
    handle: "peppermint.bsky.social",
    displayName: "Peppermint",
    description: "Season 9 finalist, trans icon",
  },
  {
    handle: "sasha.bsky.social",
    displayName: "Sasha Velour",
    description: "Winner of Season 9, brainy queen",
  },
  {
    handle: "yvie.bsky.social",
    displayName: "Yvie Oddly",
    description: "Winner of Season 11, oddball icon",
  },
  {
    handle: "priyanka.bsky.social",
    displayName: "Priyanka",
    description: "Winner of Canada's Drag Race Season 1",
  },
  {
    handle: "lawrence.bsky.social",
    displayName: "Lawrence Chaney",
    description: "Winner of UK Season 2, Scottish queen",
  },
  {
    handle: "bimini.bsky.social",
    displayName: "Bimini Bon Boulash",
    description: "UK Season 2 finalist, non-binary icon",
  },
  {
    handle: "tayce.bsky.social",
    displayName: "Tayce",
    description: "UK Season 2 finalist, Welsh goddess",
  },
  {
    handle: "thedivina.bsky.social",
    displayName: "The Vivienne",
    description: "Winner of UK Season 1 and All Stars",
  },
  {
    handle: "envy.bsky.social",
    displayName: "Envy Peru",
    description: "Winner of Holland Season 1",
  },
  {
    handle: "nicky.bsky.social",
    displayName: "Nicky Doll",
    description: "Season 12, French fashion queen",
  },
  {
    handle: "plastique.bsky.social",
    displayName: "Plastique Tiara",
    description: "Season 11, Vietnamese-American beauty",
  },
  {
    handle: "drag.bsky.social",
    displayName: "Drag Community",
    description: "General drag community account",
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
