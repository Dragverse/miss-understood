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
  // Note: Additional channels disabled pending RSS verification
  // To add more channels, get correct channel IDs from https://www.youtube.com/@handle
  // and verify RSS feed works at: https://www.youtube.com/feeds/videos.xml?channel_id={ID}
  /*
  {
    channelId: "UCjz-VzyIHVdvvPsIBIo0MGA", // TODO: Verify this channel ID
    handle: "katya",
    displayName: "Katya Zamolodchikova",
    description: "Katya - Russian bisexual transvestite hooker, comedian, and drag superstar",
  },
  {
    channelId: "UCjWn3aYXWU8BvyFQqOZiGWg", // TODO: Verify this channel ID
    handle: "bobthedragqueen",
    displayName: "Bob The Drag Queen",
    description: "Bob The Drag Queen - Winner of Season 8, comedian, and activist",
  },
  {
    channelId: "UCEoxBX0HP6H2BoCLLYFPYsg", // TODO: Verify this channel ID
    handle: "biancadelrio",
    displayName: "Bianca Del Rio",
    description: "Bianca Del Rio - Winner of Season 6, comedy queen, and insult comic",
  },
  {
    channelId: "UCvigFH6LyX8Y-xD-L3X7qTw", // TODO: Verify this channel ID
    handle: "gottmik",
    displayName: "Gottmik",
    description: "Gottmik - First trans man on Drag Race, makeup artist",
  },
  {
    channelId: "UCfRPiOY7tCMhbGqzZvqFvsA", // TODO: Verify this channel ID
    handle: "kimchi",
    displayName: "Kim Chi",
    description: "Kim Chi - Fashion and beauty queen, Season 8 finalist",
  },
  {
    channelId: "UCWSpWz5FUB5sFXdXDYlqT4g", // TODO: Verify this channel ID
    handle: "shangela",
    displayName: "Shangela",
    description: "Shangela - Professional queen, actor, and All Stars legend",
  },
  {
    channelId: "UCmvQLG_84PG_xVGGV0c1cUA", // TODO: Verify this channel ID
    handle: "aquaria",
    displayName: "Aquaria",
    description: "Aquaria - Winner of Season 10, fashion icon",
  },
  */
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
