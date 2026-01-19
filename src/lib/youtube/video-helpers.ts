import type { Video } from "@/types";

/**
 * Extract YouTube video ID from internal ID format
 * Example: "youtube-FrUOjOJh6rY" → "FrUOjOJh6rY"
 */
export function extractYouTubeId(internalId: string): string | null {
  if (!internalId.startsWith("youtube-")) return null;
  return internalId.replace("youtube-", "");
}

/**
 * Create a minimal Video object from YouTube video ID
 * This allows immediate playback without API calls
 */
export function createMinimalYouTubeVideo(internalId: string): Video {
  const youtubeId = extractYouTubeId(internalId);

  if (!youtubeId) {
    throw new Error("Invalid YouTube video ID");
  }

  return {
    id: internalId,
    title: "YouTube Video", // Placeholder
    description: "",
    thumbnail: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
    duration: 0,
    views: 0,
    likes: 0,
    createdAt: new Date(),
    playbackUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    livepeerAssetId: "",
    contentType: "long", // Default, can't determine without API
    creator: {
      did: "youtube",
      handle: "youtube",
      displayName: "YouTube Creator",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=youtube",
      description: "YouTube video",
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: false,
    },
    category: "YouTube",
    tags: [],
    source: "youtube",
    externalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    youtubeId: youtubeId,
  };
}
