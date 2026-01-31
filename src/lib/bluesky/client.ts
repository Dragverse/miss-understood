/**
 * Bluesky (AT Protocol) client for fetching content
 * Used to populate feed with drag-related videos from Bluesky
 */

import { BskyAgent } from "@atproto/api";

const BLUESKY_SERVICE = "https://bsky.social";

// Create an authenticated agent
// Note: Bluesky now requires auth even for public content
export async function getBlueskyAgent(): Promise<BskyAgent> {
  const agent = new BskyAgent({ service: BLUESKY_SERVICE });

  // Check if we have Bluesky credentials in environment
  const identifier = process.env.BLUESKY_IDENTIFIER; // e.g., "yourhandle.bsky.social"
  const password = process.env.BLUESKY_APP_PASSWORD; // App password from Bluesky settings

  if (identifier && password) {
    try {
      await agent.login({ identifier, password });
    } catch (error) {
      console.error("[Bluesky] Authentication failed:", error instanceof Error ? error.message : error);
    }
  }

  return agent;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  embed?: {
    type: string;
    video?: {
      playlist: string;
      thumbnail?: string;
      aspectRatio?: {
        width: number;
        height: number;
      };
    };
    external?: {
      uri: string;
      title?: string;
      description?: string;
      thumb?: string;
    };
    images?: Array<{
      thumb: string;
      fullsize: string;
      alt?: string;
    }>;
  };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
}

/**
 * Get posts from the "What's Hot" feed (popular posts)
 * Uses search API to find drag-related content with videos
 */
export async function searchDragContent(
  limit: number = 50
): Promise<BlueskyPost[]> {
  try {
    const agent = await getBlueskyAgent();
    const allPosts: BlueskyPost[] = [];

    // Search for drag-related posts using multiple keywords
    const searchTerms = [
      "drag queen",
      "drag race",
      "drag performance",
      "drag show",
      "dragula",
      "#drag",
      "#dragrace",
      "#dragqueen"
    ];

    console.log(`[Bluesky] Searching for drag content with ${searchTerms.length} search terms (limit: ${limit})...`);

    // Search with each term and collect results
    for (const term of searchTerms) {
      try {
        const searchResults = await agent.app.bsky.feed.searchPosts({
          q: term,
          limit: Math.ceil(limit / searchTerms.length),
        });

        if (searchResults.data.posts && searchResults.data.posts.length > 0) {
          const posts = searchResults.data.posts.map((post: any) => ({
            uri: post.uri,
            cid: post.cid,
            author: {
              did: post.author.did,
              handle: post.author.handle,
              displayName: post.author.displayName,
              avatar: post.author.avatar,
            },
            text: post.record.text || "",
            createdAt: post.record.createdAt || post.indexedAt,
            embed: post.embed
              ? {
                  type: post.embed.$type,
                  video: post.embed.video,
                  external: post.embed.external,
                  images: post.embed.images,
                }
              : undefined,
            likeCount: post.likeCount || 0,
            replyCount: post.replyCount || 0,
            repostCount: post.repostCount || 0,
          }));

          allPosts.push(...posts);
          console.log(`[Bluesky] Found ${posts.length} posts for "${term}"`);
        }
      } catch (error) {
        console.warn(`[Bluesky] Search failed for "${term}":`, error);
        continue;
      }
    }

    // Remove duplicates by URI
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.uri, post])).values()
    );

    // Calculate engagement scores and sort by engagement
    uniquePosts.forEach(post => {
      (post as any).engagementScore = calculateEngagementScore(post);
    });

    console.log(`[Bluesky] Total unique posts found: ${uniquePosts.length}`);
    return sortPostsByEngagement(uniquePosts).slice(0, limit);
  } catch (error) {
    console.error("[Bluesky] Failed to fetch content:", error);
    return [];
  }
}

/**
 * Get posts from specific drag-related accounts
 */
export async function getDragAccountsPosts(
  handles: string[],
  limit: number = 20
): Promise<BlueskyPost[]> {
  try {
    const agent = await getBlueskyAgent();
    const allPosts: BlueskyPost[] = [];

    for (const handle of handles) {
      try {
        // Resolve handle to DID
        const profile = await agent.getProfile({ actor: handle });
        const did = profile.data.did;

        // Get author's feed
        const feed = await agent.getAuthorFeed({
          actor: did,
          limit: Math.ceil(limit / handles.length),
        });

        if (feed.data.feed) {
          const posts = feed.data.feed.map((item: any) => ({
            uri: item.post.uri,
            cid: item.post.cid,
            author: {
              did: item.post.author.did,
              handle: item.post.author.handle,
              displayName: item.post.author.displayName,
              avatar: item.post.author.avatar,
            },
            text: item.post.record.text || "",
            createdAt: item.post.record.createdAt || item.post.indexedAt,
            embed: item.post.embed
              ? {
                  type: item.post.embed.$type,
                  video: item.post.embed.video,
                  external: item.post.embed.external,
                  images: item.post.embed.images,
                }
              : undefined,
            likeCount: item.post.likeCount || 0,
            replyCount: item.post.replyCount || 0,
            repostCount: item.post.repostCount || 0,
          }));

          allPosts.push(...posts);
        }
      } catch (error) {
        console.warn(`Failed to fetch posts from ${handle}:`, error);
        continue;
      }
    }

    // Calculate engagement scores and sort by engagement
    allPosts.forEach(post => {
      (post as any).engagementScore = calculateEngagementScore(post);
    });

    return sortPostsByEngagement(allPosts).slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch drag accounts posts:", error);
    return [];
  }
}

/**
 * Convert Bluesky post to our Video format
 * Includes posts with video embeds, external video links, images, or text-only posts
 */
export function blueskyPostToVideo(post: BlueskyPost): any | null {
  // Check if post has actual video content (not just images/text)
  const hasNativeVideo = !!post.embed?.video;
  const hasExternalVideo =
    post.embed?.external &&
    (post.embed.external.uri.includes("youtube") ||
      post.embed.external.uri.includes("youtu.be") ||
      post.embed.external.uri.includes("vimeo") ||
      post.embed.external.uri.includes("tiktok"));

  const hasVideo = hasNativeVideo || hasExternalVideo;

  // Only accept posts with actual video content for video feeds
  if (!hasVideo) {
    return null;
  }

  // Extract video URL
  let playbackUrl = "";
  let thumbnail = "";

  if (post.embed?.video) {
    // Native Bluesky video (HLS playlist)
    playbackUrl = post.embed.video.playlist;
    thumbnail = post.embed.video.thumbnail || "";
    console.log("[Bluesky] Native video found:", {
      playlist: playbackUrl?.substring(0, 60),
      hasThumbnail: !!thumbnail
    });
  } else if (post.embed?.external) {
    // External video link (YouTube, Vimeo, TikTok)
    playbackUrl = post.embed.external.uri;
    thumbnail = post.embed.external.thumb || "";
    console.log("[Bluesky] External video found:", {
      url: playbackUrl?.substring(0, 50),
      platform: playbackUrl.includes('youtube') ? 'YouTube' : playbackUrl.includes('tiktok') ? 'TikTok' : 'Other'
    });
  } else {
    // No valid video playback URL - skip this post
    return null;
  }

  // Generate a unique ID from the post URI
  const videoId = `bluesky-${post.uri.split("/").pop()}`;

  // Extract title (first 100 chars of text)
  const title = post.text.substring(0, 100).trim() || "Untitled";

  // Extract description (full text)
  const description = post.text;

  // Determine content type based on aspect ratio
  // Default to "short" for native Bluesky videos (most are vertical)
  // Only mark as "long" if we KNOW it's horizontal (width > height * 1.2)
  let contentType: "short" | "long" = "short"; // Default to short for native videos

  if (post.embed?.video?.aspectRatio) {
    const { width, height } = post.embed.video.aspectRatio;
    const aspectRatio = width / height;
    // Clearly horizontal (aspect > 1.2) = long-form
    // Otherwise (vertical or square) = short
    contentType = aspectRatio > 1.2 ? "long" : "short";
  } else if (post.embed?.external?.uri) {
    // For external links, check if it's a YouTube Short or TikTok
    const url = post.embed.external.uri.toLowerCase();
    if (url.includes("youtube.com/shorts") || url.includes("tiktok.com")) {
      contentType = "short";
    } else {
      // External links without aspect ratio default to long
      contentType = "long";
    }
  }
  // Native Bluesky videos without aspect ratio default to "short"

  return {
    id: videoId,
    title,
    description,
    thumbnail,
    duration: 0, // Unknown from Bluesky
    views: (post.likeCount || 0) * 10, // Estimate views from likes
    likes: post.likeCount || 0,
    createdAt: new Date(post.createdAt),
    playbackUrl,
    livepeerAssetId: "", // Not from Livepeer
    contentType,
    creator: {
      did: post.author.did,
      handle: post.author.handle,
      displayName: post.author.displayName || post.author.handle,
      avatar:
        post.author.avatar ||
        "/defaultpfp.png",
      description: "",
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: false,
    },
    category: "Performance", // Default category for Bluesky drag content
    tags: ["drag", "bluesky"],
    source: "bluesky", // Mark as external content
    externalUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`,
    internalUrl: `/profile/${post.author.handle}`, // Internal Dragverse profile route
    uri: post.uri, // Bluesky post URI for likes
    cid: post.cid, // Bluesky post CID for likes
  };
}

/**
 * Convert Bluesky post to content format (videos, images, text)
 * This is more permissive than blueskyPostToVideo and includes all content types
 * Filters for drag-relevant content to keep the feed focused
 */
export function blueskyPostToContent(post: BlueskyPost): any | null {
  const hasNativeVideo = !!post.embed?.video;
  const hasExternalVideo =
    post.embed?.external &&
    (post.embed.external.uri.includes("youtube") ||
      post.embed.external.uri.includes("youtu.be") ||
      post.embed.external.uri.includes("vimeo") ||
      post.embed.external.uri.includes("tiktok"));

  const hasVideo = hasNativeVideo || hasExternalVideo;
  const hasImages = post.embed?.images && post.embed.images.length > 0;
  const hasText = post.text && post.text.length > 0;

  // ENHANCED Drag-focused content filtering keywords
  // Organized by category for better matching
  const dragKeywords = [
    // Core drag terms (highest priority)
    'drag queen', 'drag', 'drag race', 'drag show', 'drag king', 'queen',

    // Performance & skills
    'performance', 'perform', 'runway', 'lipsync', 'lip sync', 'death drop',
    'split', 'dance', 'choreography', 'rehearsal', 'gig', 'show',

    // Appearance & style
    'look', 'lewk', 'makeup', 'beat', 'face', 'wig', 'hair', 'gown',
    'costume', 'outfit', 'fashion', 'transformation', 'reveal', 'padding',
    'contour', 'highlight', 'brows', 'lashes', 'nails', 'heels',

    // Drag slang & expressions
    'sickening', 'slay', 'fierce', 'serve', 'serving', 'werk', 'work',
    'realness', 'fish', 'fishy', 'beat', 'mug', 'paint', 'snatched',
    'gagging', 'gag', 'stunning', 'gorgeous', 'flawless', 'pussy',

    // Drag Race specific
    'charisma', 'uniqueness', 'nerve', 'talent', 'eleganza', 'extravaganza',
    'maxi challenge', 'mini challenge', 'reading', 'library', 'snatch game',
    'all stars', 'winner', 'crowned', 'shantay', 'sashay',

    // Glamour & aesthetic
    'glamour', 'glamorous', 'fabulous', 'diva', 'icon', 'legend',
    'pageant', 'crown', 'jewels', 'rhinestone', 'sparkle', 'glitter'
  ];

  const postTextLower = post.text.toLowerCase();
  const hasDragKeyword = dragKeywords.some(keyword => postTextLower.includes(keyword));

  // ENHANCED FILTERING - STRICT MODE:
  // For trending photos and visual content, require drag keywords
  // This ensures high-quality, drag-focused content

  if (hasImages && !hasVideo) {
    // Photo/image posts MUST have drag keywords to appear in trending
    if (!hasDragKeyword && (post.likeCount || 0) < 20) {
      return null; // Images need drag keywords or very high engagement
    }
  }

  if (hasVideo) {
    // Videos can be more lenient - accept if from curated accounts
    // But still prefer posts with drag keywords
  }

  if (!hasVideo && !hasImages) {
    // Text-only posts need to be substantial AND drag-related
    if (!hasText || post.text.length < 50) {
      return null; // Too short
    }

    // Require drag keywords OR high engagement (15+ likes)
    if (!hasDragKeyword && (post.likeCount || 0) < 15) {
      return null; // Not drag-focused and low engagement
    }
  }

  // Extract media URL
  let playbackUrl = "";
  let thumbnail = "";

  if (post.embed?.video) {
    // Native Bluesky video
    playbackUrl = post.embed.video.playlist;
    thumbnail = post.embed.video.thumbnail || "";
  } else if (hasExternalVideo && post.embed?.external) {
    // External video link
    playbackUrl = post.embed.external.uri;
    thumbnail = post.embed.external.thumb || "";
  } else if (hasImages && post.embed?.images) {
    // Image post - use first image
    thumbnail = post.embed.images[0].fullsize || post.embed.images[0].thumb;
    playbackUrl = ""; // No video playback for images
  } else {
    // Text-only post
    playbackUrl = "";
    thumbnail = "";
  }

  // Generate a unique ID from the post URI
  const videoId = `bluesky-${post.uri.split("/").pop()}`;

  // Extract title (first 100 chars of text)
  const title = post.text.substring(0, 100).trim() || "Untitled";

  // Extract description (full text)
  const description = post.text;

  // Determine content type
  let contentType: "short" | "long" | "podcast" = "short";
  if (hasVideo) {
    contentType =
      post.embed?.video?.aspectRatio &&
      post.embed.video.aspectRatio.width > post.embed.video.aspectRatio.height
        ? "long"
        : "short";
  }

  return {
    id: videoId,
    title,
    description,
    thumbnail,
    duration: 0,
    views: (post.likeCount || 0) * 10,
    likes: post.likeCount || 0,
    createdAt: new Date(post.createdAt),
    playbackUrl,
    livepeerAssetId: "",
    contentType,
    creator: {
      did: post.author.did,
      handle: post.author.handle,
      displayName: post.author.displayName || post.author.handle,
      avatar:
        post.author.avatar ||
        "/defaultpfp.png",
      description: "",
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: false,
    },
    category: "Performance",
    tags: ["drag", "bluesky"],
    source: "bluesky",
    externalUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`,
    internalUrl: `/profile/${post.author.handle}`,
    uri: post.uri,
    cid: post.cid,
  };
}

/**
 * Calculate engagement score for a post
 * Formula: (likes * 3 + reposts * 2 + replies * 1) * time_decay
 */
export function calculateEngagementScore(
  post: BlueskyPost,
  timeDecayHours: number = 48
): number {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;

  // Base engagement score (weighted)
  const baseScore = likes * 3 + reposts * 2 + replies * 1;

  // Time decay factor (newer posts get boost)
  const postAge = Date.now() - new Date(post.createdAt).getTime();
  const ageInHours = postAge / (1000 * 60 * 60);
  const timeDecay = Math.max(0.1, 1 - (ageInHours / timeDecayHours));

  return baseScore * timeDecay;
}

/**
 * Sort posts by engagement or recency
 */
export function sortPostsByEngagement(
  posts: BlueskyPost[],
  sortBy: "engagement" | "recent" = "engagement"
): BlueskyPost[] {
  if (sortBy === "recent") {
    return posts.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return posts.sort((a, b) =>
    calculateEngagementScore(b) - calculateEngagementScore(a)
  );
}
