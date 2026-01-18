/**
 * YouTube Data API v3 Client
 * Fetches drag-related content from YouTube similar to Bluesky integration
 */

import { Video } from "@/types";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Curated list of top drag YouTube channels
const DRAG_CHANNELS = [
  "UCQ5XdvlHSB8EhFuu8G_v5jQ", // RuPaul's Drag Race
  "UC5XLh5DlM5kIz3A0gRO5Juw", // WOW Presents Plus
  "UCOj0uHEaGxxA4EBDBYCwJsQ", // Trixie Mattel
  "UCxg_JPQFGX2Bl6gQKLpXbgg", // Katya Zamolodchikova
  "UC8ym7f5hQoFfRLhA0jdApVA", // Bob The Drag Queen
  "UCz4CifG42Wnxv-NiE3BkaCw", // Manila Luzon
  "UCfMTCQcHzVb18wFlUB3_qqQ", // Willam
  "UCgUKPf8mM1OQdBmTG-KvxRA", // UNHhhh
  "UCT-vHPWMmZCLqeY9FVjhj9Q", // Drag Race Thailand
  "UCcrkrfnxH_gqpFLXHFz3b8g", // The Boulet Brothers' Dragula
];

interface YouTubeVideo {
  id: { videoId: string } | string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high: { url: string };
      medium: { url: string };
    };
    channelTitle: string;
    channelId: string;
    publishedAt: string;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails?: {
    duration: string; // ISO 8601 format (PT1H2M10S)
  };
}

/**
 * Parse ISO 8601 duration to seconds
 * PT1H2M10S -> 3730 seconds
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calculate engagement score for sorting
 * Similar to Bluesky's algorithm
 */
function calculateEngagementScore(video: YouTubeVideo): number {
  if (!video.statistics) return 0;

  const views = parseInt(video.statistics.viewCount || "0", 10);
  const likes = parseInt(video.statistics.likeCount || "0", 10);
  const comments = parseInt(video.statistics.commentCount || "0", 10);

  // Weighted formula: likes × 5 + comments × 3 + views × 0.01
  // Time decay: newer videos get boost
  const ageInDays = (Date.now() - new Date(video.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  const timeFactor = Math.max(0, 1 - ageInDays / 365); // Decay over a year

  return (likes * 5 + comments * 3 + views * 0.01) * (1 + timeFactor);
}

/**
 * Transform YouTube video to internal Video type
 */
export function youtubeVideoToVideo(ytVideo: YouTubeVideo): Video {
  const videoId = typeof ytVideo.id === "string" ? ytVideo.id : ytVideo.id.videoId;
  const thumbnail = ytVideo.snippet.thumbnails.high?.url || ytVideo.snippet.thumbnails.medium?.url;

  // Determine content type based on duration
  let contentType: "short" | "long" | "podcast" = "long";
  if (ytVideo.contentDetails) {
    const duration = parseDuration(ytVideo.contentDetails.duration);
    if (duration <= 60) {
      contentType = "short"; // YouTube Shorts are typically < 60s
    } else if (duration > 1800) {
      contentType = "podcast"; // Long-form content > 30 min
    }
  }

  return {
    id: `youtube-${videoId}`,
    title: ytVideo.snippet.title,
    description: ytVideo.snippet.description,
    thumbnail: thumbnail || "",
    duration: ytVideo.contentDetails ? parseDuration(ytVideo.contentDetails.duration) : 0,
    views: ytVideo.statistics ? parseInt(ytVideo.statistics.viewCount || "0", 10) : 0,
    likes: ytVideo.statistics ? parseInt(ytVideo.statistics.likeCount || "0", 10) : 0,
    createdAt: new Date(ytVideo.snippet.publishedAt),
    playbackUrl: `https://www.youtube.com/watch?v=${videoId}`,
    livepeerAssetId: "",
    contentType,
    creator: {
      did: ytVideo.snippet.channelId,
      handle: ytVideo.snippet.channelTitle.toLowerCase().replace(/[^a-z0-9]/g, ""),
      displayName: ytVideo.snippet.channelTitle,
      avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${ytVideo.snippet.channelId}`,
      description: "",
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: true, // Assume verified channels
    },
    category: "Drag",
    tags: ["youtube", "drag"],
    source: "youtube",
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    internalUrl: `/profile/${ytVideo.snippet.channelTitle.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    // Store YouTube-specific metadata
    youtubeId: videoId,
    youtubeChannelId: ytVideo.snippet.channelId,
  };
}

/**
 * Fetch videos from a specific YouTube channel
 */
async function getChannelVideos(channelId: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
  try {
    // Step 1: Search for videos from the channel
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set("part", "id,snippet");
    searchUrl.searchParams.set("channelId", channelId);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", "date");
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      console.error(`YouTube API error for channel ${channelId}:`, searchResponse.status);
      return [];
    }

    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    // Step 2: Get video statistics and content details
    const videoIds = searchData.items.map((item: YouTubeVideo) =>
      typeof item.id === "string" ? item.id : item.id.videoId
    ).join(",");

    const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    videosUrl.searchParams.set("part", "statistics,contentDetails,snippet");
    videosUrl.searchParams.set("id", videoIds);
    videosUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const videosResponse = await fetch(videosUrl.toString());
    if (!videosResponse.ok) {
      return searchData.items; // Return basic data if stats fetch fails
    }

    const videosData = await videosResponse.json();
    return videosData.items || [];
  } catch (error) {
    console.error(`Failed to fetch videos for channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Fetch drag content from curated YouTube channels
 */
export async function searchDragContent(limit: number = 50): Promise<Video[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("YouTube API key not configured");
    return [];
  }

  try {
    // Fetch videos from all drag channels in parallel
    const channelPromises = DRAG_CHANNELS.slice(0, 5).map((channelId) =>
      getChannelVideos(channelId, Math.ceil(limit / 5))
    );

    const channelResults = await Promise.all(channelPromises);
    const allYouTubeVideos = channelResults.flat();

    // Transform to internal Video type
    const videos = allYouTubeVideos.map(youtubeVideoToVideo);

    // Sort by engagement score
    videos.sort((a, b) => {
      const aYt = allYouTubeVideos.find(yt =>
        (typeof yt.id === "string" ? yt.id : yt.id.videoId) === a.id.replace("youtube-", "")
      );
      const bYt = allYouTubeVideos.find(yt =>
        (typeof yt.id === "string" ? yt.id : yt.id.videoId) === b.id.replace("youtube-", "")
      );

      if (!aYt || !bYt) return 0;
      return calculateEngagementScore(bYt) - calculateEngagementScore(aYt);
    });

    return videos.slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch YouTube drag content:", error);
    return [];
  }
}

/**
 * Search YouTube videos by keyword
 */
export async function searchYouTubeVideos(query: string, limit: number = 20): Promise<Video[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("YouTube API key not configured");
    return [];
  }

  try {
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set("part", "id,snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", limit.toString());
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      console.error("YouTube search API error:", searchResponse.status);
      return [];
    }

    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    // Get full video details
    const videoIds = searchData.items.map((item: YouTubeVideo) =>
      typeof item.id === "string" ? item.id : item.id.videoId
    ).join(",");

    const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    videosUrl.searchParams.set("part", "statistics,contentDetails,snippet");
    videosUrl.searchParams.set("id", videoIds);
    videosUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const videosResponse = await fetch(videosUrl.toString());
    if (!videosResponse.ok) {
      return searchData.items.map(youtubeVideoToVideo);
    }

    const videosData = await videosResponse.json();
    return (videosData.items || []).map(youtubeVideoToVideo);
  } catch (error) {
    console.error("Failed to search YouTube:", error);
    return [];
  }
}

/**
 * Get trending YouTube videos in a category
 */
export async function getTrendingVideos(regionCode: string = "US", limit: number = 20): Promise<Video[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("YouTube API key not configured");
    return [];
  }

  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,statistics,contentDetails");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("regionCode", regionCode);
    url.searchParams.set("maxResults", limit.toString());
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("YouTube trending API error:", response.status);
      return [];
    }

    const data = await response.json();
    return (data.items || []).map(youtubeVideoToVideo);
  } catch (error) {
    console.error("Failed to fetch trending YouTube videos:", error);
    return [];
  }
}
