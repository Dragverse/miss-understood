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
    channelId: "UCRt6GN7hNT2gE7E18d_sjRQ",
    handle: "rupaulsdragrace",
    displayName: "RuPaul's Drag Race",
    description: "Official RuPaul's Drag Race channel - Watch queens compete for the crown",
  },
  {
    channelId: "UCzaQ-LjAWjT1NXg4KCalH4Q",
    handle: "wowpresents",
    displayName: "WOW Presents",
    description: "World of Wonder presents drag content, shows, and more",
  },
  {
    channelId: "UC_gYMGjaNE8xvgb-fE1lZoA",
    handle: "trixiemattel",
    displayName: "Trixie Mattel",
    description: "Trixie Mattel - Winner of All Stars 3, makeup artist, and musician",
  },
  {
    channelId: "UCjz-VzyIHVdvvPsIBIo0MGA",
    handle: "katya",
    displayName: "Katya Zamolodchikova",
    description: "Katya - Russian bisexual transvestite hooker, comedian, and drag superstar",
  },
  {
    channelId: "UCjWn3aYXWU8BvyFQqOZiGWg",
    handle: "bobthedragqueen",
    displayName: "Bob The Drag Queen",
    description: "Bob The Drag Queen - Winner of Season 8, comedian, and activist",
  },
  {
    channelId: "UCEoxBX0HP6H2BoCLLYFPYsg",
    handle: "biancadelrio",
    displayName: "Bianca Del Rio",
    description: "Bianca Del Rio - Winner of Season 6, comedy queen, and insult comic",
  },
  {
    channelId: "UCvigFH6LyX8Y-xD-L3X7qTw",
    handle: "gottmik",
    displayName: "Gottmik",
    description: "Gottmik - First trans man on Drag Race, makeup artist",
  },
  {
    channelId: "UCfRPiOY7tCMhbGqzZvqFvsA",
    handle: "kimchi",
    displayName: "Kim Chi",
    description: "Kim Chi - Fashion and beauty queen, Season 8 finalist",
  },
  {
    channelId: "UCWSpWz5FUB5sFXdXDYlqT4g",
    handle: "shangela",
    displayName: "Shangela",
    description: "Shangela - Professional queen, actor, and All Stars legend",
  },
  {
    channelId: "UCmvQLG_84PG_xVGGV0c1cUA",
    handle: "aquaria",
    displayName: "Aquaria",
    description: "Aquaria - Winner of Season 10, fashion icon",
  },
];

/**
 * Get RSS feed URL for a YouTube channel
 */
export function getChannelRSSUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/**
 * Get YouTube channel URL
 */
export function getChannelUrl(handle: string): string {
  return `https://www.youtube.com/@${handle}`;
}
