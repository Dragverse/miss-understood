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
 * Expanded to include more drag creators and performers for comprehensive coverage
 */
export async function searchDragContent(
  limit: number = 50
): Promise<BlueskyPost[]> {
  try {
    // Comprehensive drag-related accounts on Bluesky
    // Expanded from 10 to cover major performers, shows, and communities
    const dragAccounts = [
      // Official Dragverse & Major Shows
      "dragverse.app", // Dragverse official
      "rupaulsdragrace.bsky.social", // RuPaul's Drag Race
      "wowpresentsplus.bsky.social", // WOW Presents Plus
      "bbdragula.bsky.social", // Dragula
      "bouletbrothers.bsky.social", // Boulet Brothers

      // Drag Race Winners & All Stars
      "thesashacolby.bsky.social", // Sasha Colby
      "sheacoulee.com", // Shea Couleé
      "jaidaehall.bsky.social", // Jaida Essence Hall
      "symonetik.bsky.social", // Symone
      "aquaria.bsky.social", // Aquaria

      // Popular Performers
      "trixiemattel.bsky.social", // Trixie Mattel
      "katya.bsky.social", // Katya Zamolodchikova
      "bobdragqueen.bsky.social", // Bob The Drag Queen
      "maddymorphosis.bsky.social", // Maddy Morphosis
      "gottmik.bsky.social", // Gottmik
      "kimchi.bsky.social", // Kim Chi
      "violet.bsky.social", // Violet Chachki
      "biqtchpuddin.bsky.social", // Biqtch Puddin

      // Drag Kings & Non-Binary Performers
      "landonlegit.bsky.social", // Landon Cider (Drag King)
      "adamallbright.bsky.social", // Adam All (Drag King)

      // Community & Industry
      "drag.bsky.social", // General drag community
      "dragrace.bsky.social", // Drag Race community
      "dragula.bsky.social", // Dragula community
      "queer.bsky.social", // Queer community (may include drag)
    ];

    console.log(`[Bluesky] Fetching drag content from ${dragAccounts.length} accounts (limit: ${limit})...`);
    return await getDragAccountsPosts(dragAccounts, limit);
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
    // Native Bluesky video
    playbackUrl = post.embed.video.playlist;
    thumbnail = post.embed.video.thumbnail || "";
  } else if (post.embed?.external) {
    // External video link (YouTube, Vimeo, TikTok)
    playbackUrl = post.embed.external.uri;
    thumbnail = post.embed.external.thumb || "";
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
    internalUrl: `/profile/${post.author.handle}`, // Internal Dragverse profile route
    uri: post.uri, // Bluesky post URI for likes
    cid: post.cid, // Bluesky post CID for likes
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
