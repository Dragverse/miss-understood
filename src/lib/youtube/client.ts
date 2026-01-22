/**
 * YouTube Data API v3 Client
 * Fetches drag-related content from YouTube similar to Bluesky integration
 */

import { Video } from "@/types";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Drag-related search queries (ordered by likelihood of results)
const DRAG_SEARCH_QUERIES = [
  "drag race",                  // Most popular
  "drag queen",                 // Broad term
  "rupaul",                     // Specific show
  "drag performance",           // General performances
  "drag makeup",                // Popular content type
  "drag show",                  // Live performances
  "drag transformation",        // Transformation videos
  "drag lip sync",              // Performance type
];

const DRAG_HASHTAGS = [
  "#drag",
  "#dragqueen",
  "#dragrace",
  "#rupaulsdragrace",
  "#dragmakeup",
  "#dragshow",
  "#dragperformance",
  "#dragart",
];

// Verified drag YouTube channels (confirmed working)
// We'll try these first, and fall back to search if they don't work
const VERIFIED_DRAG_CHANNELS = [
  "@RuPaulsDragRace", // Official RuPaul's Drag Race
  "@WOWPresents", // WOW Presents
  "@TrixieMattel", // Trixie Mattel
  "@katya", // Katya Zamolodchikova
  "@BobTheDragQueen", // Bob The Drag Queen
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
      avatar: "/defaultpfp.png",
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
 * Search YouTube by multiple drag-related queries
 */
async function searchByQueries(queries: string[], limit: number): Promise<YouTubeVideo[]> {
  const resultsPerQuery = Math.ceil(limit / queries.length);
  const searchPromises = queries.map(async (query) => {
    try {
      const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
      searchUrl.searchParams.set("part", "id,snippet");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("order", "relevance");
      searchUrl.searchParams.set("maxResults", resultsPerQuery.toString());
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

      console.log(`[YouTube] Searching for: "${query}"`);
      const response = await fetch(searchUrl.toString());

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[YouTube] ❌ Search HTTP error for "${query}":`, {
          status: response.status,
          statusText: response.statusText,
          body: errorBody.substring(0, 200),
        });
        return [];
      }

      const data = await response.json();

      if (data.error) {
        console.error(`[YouTube] ❌ API error for "${query}":`, {
          code: data.error.code,
          message: data.error.message,
          errors: data.error.errors,
        });
        return [];
      }

      if (!data.items || data.items.length === 0) {
        console.log(`[YouTube] ⚠️  No results for "${query}" (this is normal, trying next query)`);
        return [];
      }

      console.log(`[YouTube] ✅ Found ${data.items.length} videos for "${query}"`);

      // Enrich with video details
      const videoIds = data.items.map((item: YouTubeVideo) =>
        typeof item.id === "string" ? item.id : item.id.videoId
      ).join(",");

      const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
      videosUrl.searchParams.set("part", "statistics,contentDetails,snippet");
      videosUrl.searchParams.set("id", videoIds);
      videosUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const videosResponse = await fetch(videosUrl.toString());
      if (!videosResponse.ok) {
        return data.items; // Return basic data if enrichment fails
      }

      const videosData = await videosResponse.json();
      return videosData.items || [];
    } catch (error) {
      console.error(`[YouTube] Exception searching "${query}":`, error);
      return [];
    }
  });

  const results = await Promise.all(searchPromises);
  return results.flat();
}

/**
 * Fetch drag content from YouTube using search queries and hashtags
 */
export async function searchDragContent(limit: number = 50): Promise<Video[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("[YouTube] API key not configured - skipping YouTube content");
    return [];
  }

  try {
    console.log(`[YouTube] Searching drag content with ${DRAG_SEARCH_QUERIES.length} queries (limit: ${limit})...`);

    // Use search queries instead of specific channel IDs
    const allYouTubeVideos = await searchByQueries(DRAG_SEARCH_QUERIES, limit);

    console.log(`[YouTube] Fetched ${allYouTubeVideos.length} total videos from search`);

    if (allYouTubeVideos.length === 0) {
      console.warn("[YouTube] No videos returned - check API key and quota");
      return [];
    }

    // Remove duplicates (same video from different queries)
    const uniqueVideos = Array.from(
      new Map(
        allYouTubeVideos.map((video) => [
          typeof video.id === "string" ? video.id : video.id.videoId,
          video,
        ])
      ).values()
    );

    console.log(`[YouTube] ${uniqueVideos.length} unique videos after deduplication`);

    // Transform to internal Video type
    const videos = uniqueVideos.map(youtubeVideoToVideo);

    // Sort by engagement score
    videos.sort((a, b) => {
      const aYt = uniqueVideos.find((yt) =>
        (typeof yt.id === "string" ? yt.id : yt.id.videoId) === a.id.replace("youtube-", "")
      );
      const bYt = uniqueVideos.find((yt) =>
        (typeof yt.id === "string" ? yt.id : yt.id.videoId) === b.id.replace("youtube-", "")
      );

      if (!aYt || !bYt) return 0;
      return calculateEngagementScore(bYt) - calculateEngagementScore(aYt);
    });

    const finalVideos = videos.slice(0, limit);
    console.log(`[YouTube] Returning ${finalVideos.length} videos after sorting and limiting`);
    return finalVideos;
  } catch (error) {
    console.error("[YouTube] Failed to fetch YouTube drag content:", error);
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
 * Get YouTube channel subscriber count and statistics
 */
export async function getChannelStats(channelId: string): Promise<{
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
} | null> {
  if (!YOUTUBE_API_KEY) {
    console.warn("[YouTube] API key not configured");
    return null;
  }

  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`);
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", channelId);
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`[YouTube] Failed to fetch channel stats for ${channelId}:`, response.status);
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.warn(`[YouTube] No channel found for ID ${channelId}`);
      return null;
    }

    const stats = data.items[0].statistics;
    return {
      subscriberCount: parseInt(stats.subscriberCount || "0", 10),
      videoCount: parseInt(stats.videoCount || "0", 10),
      viewCount: parseInt(stats.viewCount || "0", 10),
    };
  } catch (error) {
    console.error(`[YouTube] Exception fetching channel stats for ${channelId}:`, error);
    return null;
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
