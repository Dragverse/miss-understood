/**
 * Curated list of drag-related YouTube channels
 * These channels will be fetched via RSS feeds (no API quota limits!)
 */

export interface CuratedChannel {
  channelId: string;
  handle: string;
  displayName: string;
  description: string;
  avatar?: string;
}

/**
 * Top drag YouTube channels curated by Dragverse
 * RSS feed format: https://www.youtube.com/feeds/videos.xml?channel_id={channelId}
 */
export const CURATED_DRAG_CHANNELS: CuratedChannel[] = [
  {
    channelId: "UC0sEIyXXalzD1lbwm3D2xpA", // Updated 2026-01-18 - RSS feeds working!
    handle: "rupaulsdragrace",
    displayName: "RuPaul's Drag Race",
    description: "Official RuPaul's Drag Race channel - Watch queens compete for the crown",
  },
  {
    channelId: "UCUUUpaMp8DV6KUOfQwoIiLg", // Updated 2026-01-18 - RSS feeds working!
    handle: "wowpresents",
    displayName: "WOW Presents",
    description: "World of Wonder presents drag content, shows, and more",
  },
  {
    channelId: "UC_gYMGjaNE8xvgb-fE1lZoA", // Trixie Mattel - RSS verified 2026-01-21
    handle: "trixiemattel",
    displayName: "Trixie Mattel",
    description: "Trixie Mattel - Winner of All Stars 3, makeup artist, and musician",
  },
  {
    channelId: "UCjWn3aYXWU8BvyFQqOZiGWg", // Bob The Drag Queen - RSS verified 2026-01-21
    handle: "bobthedragqueen",
    displayName: "Bob The Drag Queen",
    description: "Bob The Drag Queen - Winner of Season 8, comedian, and activist",
  },
  {
    channelId: "UCEoxBX0HP6H2BoCLLYFPYsg", // Bianca Del Rio - RSS verified 2026-01-21
    handle: "biancadelrio",
    displayName: "Bianca Del Rio",
    description: "Bianca Del Rio - Winner of Season 6, comedy queen, and insult comic",
  },
  {
    channelId: "UCb3Oph7yUq5jPDO1Q61qcMw", // Katya Zamolodchikova
    handle: "katya",
    displayName: "Katya Zamolodchikova",
    description: "Katya - Russian bisexual transvestite hooker, comedian, and drag superstar",
  },
  {
    channelId: "UCeHAShKyGQIJ262xboI0oVQ", // Sasha Velour
    handle: "sashavelour",
    displayName: "Sasha Velour",
    description: "Sasha Velour - Winner of Season 9, artist, and nightlife legend",
  },
  {
    channelId: "UC7-S6iRXVUQ2AsVjrJC-xfg", // Manila Luzon
    handle: "manilaluzon",
    displayName: "Manila Luzon",
    description: "Manila Luzon - All Stars queen and fashion icon",
  },
  {
    channelId: "UCSKnlPjYji7RJbvPxPepgfA", // Alyssa Edwards
    handle: "alyssaedwards",
    displayName: "Alyssa Edwards",
    description: "Alyssa Edwards - Dance teacher, All Stars queen, and queen of tongue pops",
  },
  {
    channelId: "UCqGh3IjZ02rlBjq1u9g4eHw", // Jinkx Monsoon
    handle: "jinkxmonsoon",
    displayName: "Jinkx Monsoon",
    description: "Jinkx Monsoon - Winner of Season 5 and All Stars 7",
  },
  {
    channelId: "UCuhKIYy7mOh76V7dWh600Mg", // Willam
    handle: "willam",
    displayName: "Willam",
    description: "Willam - Season 4 queen, actor, and YouTube icon",
  },
  {
    channelId: "UCOTowPfU-1M-7l6hGE5l3xg", // Violet Chachki
    handle: "violetchachki",
    displayName: "Violet Chachki",
    description: "Violet Chachki - Winner of Season 7, burlesque performer",
  },
  {
    channelId: "UCLFvHz1W9TKPPYVr8U0AJPA", // Kim Chi
    handle: "kimchi",
    displayName: "Kim Chi",
    description: "Kim Chi - Fashion and beauty queen from Season 8",
  },
  {
    channelId: "UCfFEFk3yQ7eXqVTmQWUXQAQ", // Adore Delano
    handle: "adoredelano",
    displayName: "Adore Delano",
    description: "Adore Delano - Season 6 queen and recording artist",
  },
  {
    channelId: "UCLuuQ4eZQd0RSHYJ6R-4VdQ", // Gottmik
    handle: "gottmik",
    displayName: "Gottmik",
    description: "Gottmik - First trans man on Drag Race, makeup artist",
  },
];

/**
 * Music-focused drag channels for the audio page
 * Avatars are dynamically fetched via avatar-fetcher.ts
 */
export const DRAG_MUSIC_CHANNELS: CuratedChannel[] = [
  {
    channelId: "UC_gYMGjaNE8xvgb-fE1lZoA", // Trixie Mattel (music focus)
    handle: "trixiemattel",
    displayName: "Trixie Mattel",
    description: "Drag queen, comedian, and recording artist",
  },
  {
    channelId: "UCUUUpaMp8DV6KUOfQwoIiLg", // WOW Presents (music performances)
    handle: "wowpresents",
    displayName: "WOW Presents",
    description: "Drag performances, music, and entertainment",
  },
];

/**
 * Curated drag music playlists for the audio page
 * RSS feed format: https://www.youtube.com/feeds/videos.xml?playlist_id={playlistId}
 */
export interface DragPlaylist {
  playlistId: string;
  name: string;
  description: string;
}

export const DRAG_MUSIC_PLAYLISTS: DragPlaylist[] = [
  {
    playlistId: "PLobBk6-xk93Iwawut2lo3O7dRpcBo75if",
    name: "Drag Music Collection",
    description: "Curated drag music playlist with performances and tracks",
  },
];

/**
 * Get RSS feed URL for a YouTube channel
 * Try both channel_id and user formats as fallback
 */
export function getChannelRSSUrl(channelId: string, handle?: string): string {
  // Primary: Use channel_id
  // Note: Some channels may not have working RSS feeds
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/**
 * Get RSS feed URL for a YouTube playlist
 */
export function getPlaylistRSSUrl(playlistId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
}

/**
 * Get alternative RSS feed URL using channel handle
 */
export function getChannelRSSUrlByHandle(handle: string): string {
  return `https://www.youtube.com/feeds/videos.xml?user=${handle}`;
}

/**
 * Get YouTube channel URL
 */
export function getChannelUrl(handle: string): string {
  return `https://www.youtube.com/@${handle}`;
}
