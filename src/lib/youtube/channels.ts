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
channelId: "UC0sEIyXXalzD1lbwm3D2xpA",
handle: "rupaulsdragrace",
displayName: "RuPaul's Drag Race",
description: "Official RuPaul's Drag Race channel - Watch queens compete for the crown",
},
{
channelId: "UCUUUpaMp8DV6KUOfQwoIiLg",
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
channelId: "UCb3Oph7yUq5jPDO1Q61qcMw",
handle: "katya",
displayName: "Katya Zamolodchikova",
description: "Katya - Russian bisexual transvestite hooker, comedian, and drag superstar",
},
{
channelId: "UCeHAShKyGQIJ262xboI0oVQ",
handle: "sashavelour",
displayName: "Sasha Velour",
description: "Sasha Velour - Winner of Season 9, artist, and nightlife legend",
},
{
channelId: "UC7-S6iRXVUQ2AsVjrJC-xfg",
handle: "manilaluzon",
displayName: "Manila Luzon",
description: "Manila Luzon - All Stars queen and fashion icon",
},
{
channelId: "UCSKnlPjYji7RJbvPxPepgfA",
handle: "alyssaedwards",
displayName: "Alyssa Edwards",
description: "Alyssa Edwards - Dance teacher, All Stars queen, and queen of tongue pops",
},
{
channelId: "UCqGh3IjZ02rlBjq1u9g4eHw",
handle: "jinkxmonsoon",
displayName: "Jinkx Monsoon",
description: "Jinkx Monsoon - Winner of Season 5 and All Stars 7",
},
{
channelId: "UCuhKIYy7mOh76V7dWh600Mg",
handle: "willam",
displayName: "Willam",
description: "Willam - Season 4 queen, actor, and YouTube icon",
},
{
channelId: "UCOTowPfU-1M-7l6hGE5l3xg",
handle: "violetchachki",
displayName: "Violet Chachki",
description: "Violet Chachki - Winner of Season 7, burlesque performer",
},
{
channelId: "UCLFvHz1W9TKPPYVr8U0AJPA",
handle: "kimchi",
displayName: "Kim Chi",
description: "Kim Chi - Fashion and beauty queen from Season 8",
},
{
channelId: "UCfFEFk3yQ7eXqVTmQWUXQAQ",
handle: "adoredelano",
displayName: "Adore Delano",
description: "Adore Delano - Season 6 queen and recording artist",
},
{
channelId: "UCLuuQ4eZQd0RSHYJ6R-4VdQ",
handle: "gottmik",
displayName: "Gottmik",
description: "Gottmik - First trans man on Drag Race, makeup artist",
},

// === DRAG MAKEUP & BEAUTY CHANNELS ===
// TODO: Find real channel IDs - visit youtube.com/@handle, view page source, search for "channelId"
{
channelId: "UCwy1ssy9nXzeaPeT4Dgk1vw", // ✅ Verified 2026-01-31
handle: "ellismiah",
displayName: "Ellis Miah",
description: "Drag makeup artist and beauty content creator",
},
{
channelId: "UC_gYMGjaNE8xvgb-fE1lZoA", // ✅ Same as Trixie Mattel main - Verified 2026-01-30
handle: "trixiecosmetics",
displayName: "Trixie Cosmetics",
description: "Official Trixie Cosmetics makeup brand channel",
},
{
channelId: "UCDHQbU57NZilrhbuZNbQcRA", // ✅ Verified 2026-01-30
handle: "patrickstarrr",
displayName: "Patrick Starrr",
description: "Beauty influencer and drag makeup icon",
},
{
channelId: "UC0xujEADUB6tV4QpAjtbMrw", // ✅ Verified 2026-01-30 (@vanjie)
handle: "missvanjie",
displayName: "Miss Vanjie",
description: "Miss Vanjie makeup tutorials and beauty content",
},
{
channelId: "UCtt4mZtJP9Xz9J-Jw5Mp69w", // ✅ Verified 2026-01-30 (@raven)
handle: "ravenbeautybar",
displayName: "Raven",
description: "Raven - Makeup artist and beauty guru",
},

// === ADDITIONAL DRAG PERFORMERS ===
// Note: The Vivienne (RIP 2025) - Channel may exist but handle not found
{
channelId: "UC4KPJXa_fO893k5_xHLZRKA", // ✅ Verified 2026-01-30
handle: "biminibabes",
displayName: "Bimini Bon-Boulash",
description: "Bimini Bon-Boulash - Drag Race UK finalist, model, and activist",
},
{
channelId: "UC5t6alAyno_ehV_XvGSkjAg", // ✅ Verified 2026-01-30
handle: "peppermint247",
displayName: "Peppermint",
description: "Peppermint - Season 9 finalist, actress, and trans activist",
},
{
channelId: "UClPZD35J-ewPmzaH15cVeVA", // ✅ Verified 2026-01-30 (@bhytes)
handle: "brooklynnhytes",
displayName: "Brooke Lynn Hytes",
description: "Brooke Lynn Hytes - Drag Race Canada host and performer",
},
{
channelId: "UCVt8ODTrk7SZrX3WGp5W3CA", // ✅ Verified 2026-01-30 (@landoncider)
handle: "landonciider",
displayName: "Landon Cider",
description: "Landon Cider - Drag King and winner of The Boulet Brothers' Dragula Season 3",
},
{
channelId: "UCJS_8VXQdTIzcmAXdOA6INQ", // ✅ Verified 2026-01-30 (@bouletbrothers)
handle: "thebouletbrothers",
displayName: "The Boulet Brothers",
description: "The Boulet Brothers - Creators of Dragula, horror and alternative drag icons",
},
{
channelId: "UCiojereb1wpuQLC3_AmoUwA", // ✅ Verified 2026-01-31
handle: "victoriastone",
displayName: "Victoria Stone",
description: "Victoria Stone - Drag King performer and LGBTQ+ advocate",
},
{
channelId: "UCYwisUNenm0om3aOQIG_NmA", // ✅ Verified 2026-01-31
handle: "scarletenvy",
displayName: "Scarlet Envy",
description: "Scarlet Envy - Season 11 queen and artist",
},
{
channelId: "UCS5O0IDeMpgJkm8C2yhW-LA", // ✅ Verified 2026-01-31
handle: "crystalmethyd",
displayName: "Crystal Methyd",
description: "Crystal Methyd - Season 12 finalist, creative and colorful performer",
},
{
channelId: "UCjKtbySaUa35Rnq-oTSUY-A", // ✅ Verified 2026-01-31
handle: "evieoddly",
displayName: "Yvie Oddly",
description: "Yvie Oddly - Winner of Season 11, avant-garde drag artist",
},
{
channelId: "UCa-aCkCKMbjRpmkYYonJHMg", // ✅ Verified 2026-01-31
handle: "sharonneedles",
displayName: "Sharon Needles",
description: "Sharon Needles - Winner of Season 4, horror drag pioneer",
},
{
channelId: "UC5KyJaxERRYkeWJF6Zk9vmw", // ✅ Verified 2026-01-31
handle: "courtneyact",
displayName: "Courtney Act",
description: "Courtney Act - Season 6 finalist, singer, and TV personality",
},
{
channelId: "UCZD-ATyvnZ2NiBakOPQ7VIw", // ✅ Verified 2026-01-31
handle: "latriceroyale",
displayName: "Latrice Royale",
description: "Latrice Royale - Fan favorite from Season 4 and All Stars 1 & 4",
},
{
channelId: "UClA8KInDYUVELzSd6Mdqm1w", // ✅ Verified 2026-01-31
handle: "heidincloset",
displayName: "Heidi N Closet",
description: "Heidi N Closet - Miss Congeniality of Season 12, performer and comedian",
},
{
channelId: "UCEJmzWh3j2FYLealOktTWjw", // ✅ Verified 2026-01-30
handle: "kandyho",
displayName: "Kandy Ho",
description: "Kandy Ho - Puerto Rican queen from Season 7, performer and host",
},
{
channelId: "UCdWlvIvdGKv75nmmmnsqofg", // ✅ Verified 2026-01-30 (@dragula)
handle: "dragulaofficial",
displayName: "Dragula Official",
description: "Official channel for The Boulet Brothers' Dragula - horror, filth, and glamour",
},

// === DRAG PODCASTS ON YOUTUBE ===
{
channelId: "UCQ-vA635R9YKEg7vpbpJhjQ", // Race Chaser with Alaska & Willam
handle: "racechaserpodcast",
displayName: "Race Chaser",
description: "Alaska and Willam recap every Drag Race episode with humor and insight",
},
{
channelId: "UCEfNT9eAJ1wG6v4KlJQZ7cg", // Sibling Rivalry
handle: "siblingrivalrypodcast",
displayName: "Sibling Rivalry",
description: "Bob The Drag Queen and Monét X Change debate, laugh, and spill drag tea",
},
{
channelId: "UCvXQKasFXu3SRfm7skV_xQg", // UNHhhh
handle: "wowpresentsplus",
displayName: "UNHhhh",
description: "Trixie Mattel and Katya discuss everything and nothing — chaotic brilliance",
},
{
channelId: "UCN4hDYbxNBNPtGM3WFZYdZg", // Hey Qween!
handle: "heyqween",
displayName: "Hey Qween!",
description: "Jonny McGovern interviews drag legends and queer icons in long-form chats",
},
{
channelId: "UCkqkAQeLfE0gE0YTlJKTZGg", // Very That
handle: "verythatpodcast",
displayName: "VERY THAT",
description: "Delta Work and Raja discuss drag, pop culture, and the art of being unbothered",
},
{
channelId: "UCDwvYQ6qEyp0PQMM4FiyhQQ", // Hot Goss
handle: "hotgosspodcast",
displayName: "Hot Goss",
description: "Weekly drag news and gossip from the Race Chaser team",
},
{
channelId: "UCizrXRV6EgHXME3t7gHx0dg", // Drag Her!
handle: "dragherpodcast",
displayName: "Drag Her!",
description: "Mano Agapion and guests recap Drag Race episodes with comedy and chaos",
},
{
channelId: "UCN0u6sfqARgFErgCB5gmnzA", // Sloppy Seconds Podcast
handle: "sloppysecondspodcast",
displayName: "Sloppy Seconds",
description: "Big Dipper and Meatball talk drag, sex, and queer life with hilarious guests",
},
{
channelId: "UCZYdJM36Nzd8gYZ3dUQLh5Q", // No Gorge
handle: "nogorgepodcast",
displayName: "No Gorge",
description: "Naomi Smalls and Kim Chi talk drag, fashion, and friendship",
},
{
channelId: "UCRIEhqCfVz_LKvHG8xUJeHw", // The Drag Detectives
handle: "dragdetectives",
displayName: "The Drag Detectives",
description: "Fans analyze Drag Race edits, theories, and controversies with humor",
},

// === NEW ADDITIONS 2026-02-06 ===
{
  channelId: "UC8rkCF5kyJT7YYR46xCecqw",
  handle: "jaymesmansfield",
  displayName: "Jaymes Mansfield",
  description: "Season 9 queen, wig styling tutorials, LGBTQ+ history",
},
{
  channelId: "UCLuk2l_hPJW907XX74BSq8Q",
  handle: "monetxchange",
  displayName: "Monet X Change",
  description: "Winner of All Stars 4, comedian, podcaster",
},
{
  channelId: "UCtlU7bUDxz2Lv6EJrgKfUzg",
  handle: "aquaria",
  displayName: "Aquaria",
  description: "Winner of Season 10, fashion icon",
},
{
  channelId: "UCSwl9DAdv_x90Ywsf7b3lnQ",
  handle: "plastiquetiara",
  displayName: "Plastique Tiara",
  description: "Season 11 finalist, beauty and fashion content",
},
{
  channelId: "UCr2gApA6rOjLJVU1ESicAyQ",
  handle: "trinitythetuck",
  displayName: "Trinity The Tuck",
  description: "Winner of All Stars 4, pageant queen",
},
{
  channelId: "UCFtHBuMwoQFxVM7RmCrK4Fw",
  handle: "denali",
  displayName: "Denali",
  description: "Season 13 queen, ice skater, performance artist",
},
{
  channelId: "UCDTtixbys-bb2WtJwqWoeMw",
  handle: "jackfed",
  displayName: "JackFed",
  description: "Drag Race reviews and sensual commentary",
},
{
  channelId: "UCdJAxOAT62RkCI7s7X8S8WA",
  handle: "runnereye",
  displayName: "RunnerEye",
  description: "Absurd tier lists and drag race entertainment",
},
{
  channelId: "UCnf9PTuVou0nOwxOSFnc7ag",
  handle: "pressedconference",
  displayName: "Pressed Conference",
  description: "Drag Race recap and discussion",
},
{
  channelId: "UCNaNtF7f4kZrFyl7M4rDNcQ",
  handle: "moviebitches",
  displayName: "Movie Bitches",
  description: "Pop culture and drag commentary",
},
{
  channelId: "UCuiK2XdDcyAd7TS9ioMqx6A",
  handle: "logotv",
  displayName: "Logo TV",
  description: "Official Logo TV drag content",
},
{
  channelId: "UCxNG8iqKTjJu8uPlbCc1kyA",
  handle: "reinasalti",
  displayName: "Reina Salti",
  description: "Drag content creator",
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
