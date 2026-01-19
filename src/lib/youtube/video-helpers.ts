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
 * Detect if a YouTube thumbnail indicates a Short (portrait orientation)
 * YouTube Shorts have portrait thumbnails (height > width)
 */
async function detectShortFromThumbnail(youtubeId: string): Promise<boolean> {
  try {
    // Try to get thumbnail dimensions from YouTube's image service
    // Use hqdefault as it's more reliable than maxresdefault for dimension checking
    const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    // In browser environment, we can use Image to check dimensions
    if (typeof window !== "undefined") {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve(img.height > img.width);
        };
        img.onerror = () => {
          resolve(false); // Default to long-form on error
        };
        img.src = thumbnailUrl;
      });
    }

    // In Node environment, default to long-form
    return false;
  } catch {
    return false; // Default to long-form on any error
  }
}

/**
 * Create a minimal Video object from YouTube video ID
 * This allows immediate playback without API calls
 *
 * @param internalId - Internal video ID format: "youtube-{videoId}"
 * @param contentType - Optional content type override if known
 */
export function createMinimalYouTubeVideo(
  internalId: string,
  contentType?: "short" | "long"
): Video {
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
    contentType: contentType || "long", // Use provided type or default to long
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

/**
 * Create a minimal Video object with automatic Short detection
 * This checks thumbnail dimensions to determine if it's a Short
 * Use this for better accuracy when orientation matters
 */
export async function createMinimalYouTubeVideoWithDetection(
  internalId: string
): Promise<Video> {
  const youtubeId = extractYouTubeId(internalId);

  if (!youtubeId) {
    throw new Error("Invalid YouTube video ID");
  }

  // Detect if this is a Short by checking thumbnail orientation
  const isShort = await detectShortFromThumbnail(youtubeId);
  const contentType = isShort ? "short" : "long";

  return createMinimalYouTubeVideo(internalId, contentType);
}
