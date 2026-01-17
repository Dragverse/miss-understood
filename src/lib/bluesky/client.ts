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
      console.log(`✓ Authenticated with Bluesky as ${identifier}`);
    } catch (error) {
      console.error("❌ Bluesky authentication failed");
      console.error("Error:", error instanceof Error ? error.message : error);
      console.log("Identifier:", identifier);
      console.log("Password:", password.substring(0, 4) + "..." + password.substring(password.length - 4));
      console.log("\nTo fix:");
      console.log("1. Go to https://bsky.app/settings/app-passwords");
      console.log("2. Create a new app password (or verify the existing one)");
      console.log("3. Update BLUESKY_APP_PASSWORD in .env.local");
      console.log("4. Restart the dev server");
    }
  } else {
    console.warn("Bluesky credentials not configured. Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in .env.local");
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
 * This doesn't require authentication and includes trending content
 */
export async function searchDragContent(
  limit: number = 50
): Promise<BlueskyPost[]> {
  try {
    // Use popular drag-related accounts as a feed source
    // These are verified accounts that exist on Bluesky
    const dragAccounts = [
      "rupaulsdragrace.bsky.social",
      "drag.bsky.social",
      "dragqueen.bsky.social",
      "queendom.bsky.social",
      "lgbtq.bsky.social",
      "thevivllainous.bsky.social",
      "deltabadhand.bsky.social",
      "tenderoni88.bsky.social",
      "fayludes.bsky.social",
      "rupawl.bsky.social",
      "ajquinwest.bsky.social",
      "wowpresentsplus.bsky.social",
      "thesashacolby.bsky.social",
      "paintedwithraven.bsky.social",
      "junobirch.bsky.social",
      "amandatorimeating.bsky.social",
      "upuntildawn.net",
      "ckdesignedit.bsky.social",
      "dragverse.app",
      "sherrypoppins.bsky.social",
      "xunamimuse.bsky.social",
      "maddymorphosis.bsky.social",
      "vandervonodd.bsky.social",
      "pietraparker.com",
      "sheacoulee.com",
      "dragracemexico.bsky.social",
      "dragrace-brasil.bsky.social",
      "ramonaslick.bsky.social",
      "evahdestruction.bsky.social",
      "notpi.net",
      "bbdragula.bsky.social",
      "bouletbrothers.bsky.social",
      "therealelvira.bsky.social",
      "rupaulsdragcon.bsky.social",
      "dragracelive.bsky.social",
      "dragraceph.bsky.social",
      "jaidaehall.bsky.social",
      "thepandoraboxx.bsky.social",
      "biblegirl666.bsky.social",
      "theonlydetox.bsky.social",
      "jasminekennedie.bsky.social",
      "estrellaxtra.bsky.social",
      

















      










    ];

    return await getDragAccountsPosts(dragAccounts, limit);
  } catch (error) {
    console.error("Failed to fetch Bluesky content:", error);
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
 * Includes posts with video embeds, external video links, or images (treated as content)
 */
export function blueskyPostToVideo(post: BlueskyPost): any | null {
  // Check if post has video content or images
  const hasVideo =
    post.embed?.video ||
    (post.embed?.external &&
      (post.embed.external.uri.includes("youtube") ||
        post.embed.external.uri.includes("youtu.be") ||
        post.embed.external.uri.includes("vimeo") ||
        post.embed.external.uri.includes("tiktok")));

  const hasImages = post.embed?.images && post.embed.images.length > 0;

  // Accept posts with video OR images (drag content often shared as images)
  if (!hasVideo && !hasImages) {
    return null;
  }

  // Extract video URL
  let playbackUrl = "";
  let thumbnail = "";

  if (post.embed?.video) {
    playbackUrl = post.embed.video.playlist;
    thumbnail = post.embed.video.thumbnail || "";
  } else if (post.embed?.external) {
    playbackUrl = post.embed.external.uri;
    thumbnail = post.embed.external.thumb || "";
  } else if (hasImages) {
    // For image posts, use first image as thumbnail and link to Bluesky post
    thumbnail = post.embed!.images![0].fullsize;
    playbackUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;
  }

  // Generate a unique ID from the post URI
  const videoId = `bluesky-${post.uri.split("/").pop()}`;

  // Extract title (first 100 chars of text)
  const title = post.text.substring(0, 100).trim() || "Untitled";

  // Extract description (full text)
  const description = post.text;

  // Determine content type based on aspect ratio or default to short
  const contentType =
    post.embed?.video?.aspectRatio &&
    post.embed.video.aspectRatio.width > post.embed.video.aspectRatio.height
      ? "long"
      : "short";

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
        `https://api.dicebear.com/9.x/avataaars/svg?seed=${post.author.did}`,
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
