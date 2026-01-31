/**
 * YouTube RSS Feed Client
 * Fetches YouTube content via RSS feeds (no API quota limits!)
 *
 * RSS Feed format: https://www.youtube.com/feeds/videos.xml?channel_id={channelId}
 */

import { Video } from "@/types";
import { CURATED_DRAG_CHANNELS, getChannelRSSUrl } from "./channels";
import { XMLParser } from "fast-xml-parser";
import { getYouTubeChannelAvatar } from "./avatar-fetcher";

interface RSSVideo {
  "yt:videoId": string;
  "yt:channelId": string;
  title: string;
  link: { "@_href": string };
  author: { name: string; uri: string };
  published: string;
  updated: string;
  "media:group": {
    "media:title": string;
    "media:content": { "@_url": string; "@_type": string; "@_width": string; "@_height": string };
    "media:thumbnail": { "@_url": string; "@_width": string; "@_height": string };
    "media:description": string;
    "media:community": {
      "media:starRating": { "@_count": string; "@_average": string; "@_min": string; "@_max": string };
      "media:statistics": { "@_views": string };
    };
  };
}

/**
 * Fetch RSS feed for a YouTube channel
 */
async function fetchChannelRSS(channelId: string): Promise<RSSVideo[]> {
  try {
    const url = getChannelRSSUrl(channelId);
    console.log(`[YouTube RSS] Fetching feed: ${url}`);

    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DragverseBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`[YouTube RSS] Failed to fetch ${channelId}: ${response.status} ${response.statusText}`);
      return [];
    }

    const xmlText = await response.text();
    if (xmlText.length < 100) {
      console.error(`[YouTube RSS] Suspiciously short response (${xmlText.length} bytes):`, xmlText);
      return [];
    }
    console.log(`[YouTube RSS] Received ${xmlText.length} bytes of XML`);

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const result = parser.parse(xmlText);

    // Extract entries from feed
    const entries = result?.feed?.entry;
    if (!entries) {
      console.warn(`[YouTube RSS] No entries found for channel ${channelId}`);
      return [];
    }

    // Ensure entries is an array
    const videoEntries = Array.isArray(entries) ? entries : [entries];
    console.log(`[YouTube RSS] Found ${videoEntries.length} videos from ${channelId}`);

    return videoEntries;
  } catch (error) {
    console.error(`[YouTube RSS] Error fetching channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Fetch RSS feed for a YouTube playlist
 */
async function fetchPlaylistRSS(playlistId: string): Promise<RSSVideo[]> {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    console.log(`[YouTube RSS] Fetching playlist feed: ${url}`);

    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DragverseBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`[YouTube RSS] Failed to fetch playlist ${playlistId}: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    if (xmlText.length < 100) {
      console.error(`[YouTube RSS] Suspiciously short response for playlist`);
      return [];
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const result = parser.parse(xmlText);
    const entries = result?.feed?.entry;

    if (!entries) {
      console.warn(`[YouTube RSS] No entries found in playlist ${playlistId}`);
      return [];
    }

    const videoEntries = Array.isArray(entries) ? entries : [entries];
    console.log(`[YouTube RSS] Found ${videoEntries.length} videos from playlist ${playlistId}`);

    return videoEntries;
  } catch (error) {
    console.error(`[YouTube RSS] Error fetching playlist ${playlistId}:`, error);
    return [];
  }
}

/**
 * Transform RSS video entry to internal Video type
 */
async function rssVideoToVideo(rssVideo: RSSVideo): Promise<Video> {
  const videoId = rssVideo["yt:videoId"];
  const channelId = rssVideo["yt:channelId"];
  const channel = CURATED_DRAG_CHANNELS.find(ch => ch.channelId === channelId);

  const title = rssVideo["media:group"]["media:title"] || rssVideo.title;
  const description = rssVideo["media:group"]["media:description"] || "";

  // Extract thumbnail URL from RSS, or fallback to YouTube's CDN pattern
  // YouTube provides guaranteed thumbnail URLs for all videos (Shorts and regular)
  const rssThumbnail = rssVideo["media:group"]["media:thumbnail"]?.["@_url"] || "";
  const thumbnail = rssThumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const views = parseInt(rssVideo["media:group"]["media:community"]?.["media:statistics"]?.["@_views"] || "0", 10);
  const publishedAt = new Date(rssVideo.published);

  // Fetch YouTube channel avatar dynamically
  let channelAvatar = channel?.avatar || "/defaultpfp.png";
  if (channelId && channelAvatar === "/defaultpfp.png") {
    try {
      channelAvatar = await getYouTubeChannelAvatar(channelId, channel?.handle);
    } catch (error) {
      console.warn(`[RSS Client] Failed to fetch avatar for channel ${channelId}:`, error);
    }
  }

  // Detect shorts based on title/description keywords and YouTube patterns
  // YouTube Shorts often have "#shorts" hashtag or specific keywords
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const isLikelyShort =
    titleLower.includes("#shorts") ||
    titleLower.includes("#short") ||
    descLower.includes("#shorts") ||
    descLower.includes("#short") ||
    titleLower.includes("shorts") && titleLower.length < 100; // Short title with "shorts" keyword

  // Default to short if detected, otherwise long
  // Note: RSS doesn't provide duration, so this is best-effort detection
  const contentType = isLikelyShort ? "short" : "long";

  return {
    id: `youtube-${videoId}`,
    title,
    description,
    thumbnail,
    duration: 0, // RSS doesn't provide duration
    views,
    likes: 0, // RSS doesn't provide likes
    createdAt: publishedAt,
    playbackUrl: `https://www.youtube.com/watch?v=${videoId}`,
    livepeerAssetId: "",
    contentType,
    creator: {
      did: channelId,
      handle: channel?.handle || "youtube",
      displayName: channel?.displayName || rssVideo.author?.name || "YouTube Channel",
      avatar: channelAvatar,
      description: channel?.description || "",
      followerCount: 0,
      followingCount: 0,
      youtubeChannelId: channelId, // YouTube channel ID for follow button
      youtubeChannelName: channel?.displayName || rssVideo.author?.name || "YouTube Channel",
      createdAt: publishedAt,
      verified: true,
    },
    category: "Drag",
    tags: ["youtube", "drag"],
    source: "youtube",
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    internalUrl: `/profile/${channel?.handle || "youtube"}`,
    youtubeId: videoId,
    youtubeChannelId: channelId,
  };
}

/**
 * Fetch drag content from curated YouTube channels via RSS
 * No API quota limits!
 */
export async function fetchCuratedDragContent(limit: number = 50): Promise<Video[]> {
  try {
    console.log(`[YouTube RSS] Fetching from ${CURATED_DRAG_CHANNELS.length} curated channels...`);

    // Fetch RSS feeds from all channels in parallel
    const feedPromises = CURATED_DRAG_CHANNELS.map(channel =>
      fetchChannelRSS(channel.channelId)
    );

    const allFeeds = await Promise.all(feedPromises);
    const allVideos = allFeeds.flat();

    console.log(`[YouTube RSS] Fetched ${allVideos.length} total videos from RSS feeds`);

    if (allVideos.length === 0) {
      console.warn("[YouTube RSS] No videos found in any channel feeds");
      return [];
    }

    // Transform to internal Video type
    const videos = await Promise.all(allVideos.map(rssVideoToVideo));

    // Sort by date (newest first)
    videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Limit results
    const limitedVideos = videos.slice(0, limit);

    console.log(`[YouTube RSS] Returning ${limitedVideos.length} videos after sorting and limiting`);
    return limitedVideos;
  } catch (error) {
    console.error("[YouTube RSS] Failed to fetch curated drag content:", error);
    return [];
  }
}

/**
 * Fetch only YouTube Shorts from curated channels
 */
export async function fetchCuratedShorts(limit: number = 30): Promise<Video[]> {
  const allVideos = await fetchCuratedDragContent(limit * 2); // Fetch more to filter
  const shorts = allVideos.filter(v => v.contentType === "short");
  return shorts.slice(0, limit);
}

/**
 * Fetch videos from curated drag music playlists
 * Primarily for the /audio page
 */
export async function fetchCuratedMusicPlaylists(limit: number = 50): Promise<Video[]> {
  try {
    const { DRAG_MUSIC_PLAYLISTS } = await import("./channels");
    console.log(`[YouTube RSS] Fetching from ${DRAG_MUSIC_PLAYLISTS.length} music playlists...`);

    // Fetch RSS feeds from all playlists in parallel
    const playlistPromises = DRAG_MUSIC_PLAYLISTS.map(playlist =>
      fetchPlaylistRSS(playlist.playlistId)
    );

    const allFeeds = await Promise.all(playlistPromises);
    const allVideos = allFeeds.flat();

    console.log(`[YouTube RSS] Fetched ${allVideos.length} videos from music playlists`);

    if (allVideos.length === 0) {
      return [];
    }

    // Transform to internal Video type, force contentType to "music"
    const videos = await Promise.all(
      allVideos.map(async (rssVideo) => {
        const video = await rssVideoToVideo(rssVideo);
        return {
          ...video,
          contentType: "music" as const, // Force music type for playlist content
        };
      })
    );

    // Sort by date (newest first)
    videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Limit results
    return videos.slice(0, limit);
  } catch (error) {
    console.error("[YouTube RSS] Failed to fetch music playlists:", error);
    return [];
  }
}
