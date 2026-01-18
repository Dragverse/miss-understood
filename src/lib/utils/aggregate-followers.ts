/**
 * Aggregate follower/following counts from YouTube, Bluesky, and Dragverse
 */

import { getChannelStats } from "@/lib/youtube/client";

export interface AggregatedStats {
  // Total counts (sum of all platforms)
  totalFollowers: number;
  totalFollowing: number;

  // Per-platform breakdowns
  dragverseFollowers: number;
  dragverseFollowing: number;
  blueskyFollowers: number;
  blueskyFollowing: number;
  youtubeSubscribers: number;

  // Metadata
  lastUpdated: Date;
  platforms: {
    dragverse: boolean;
    bluesky: boolean;
    youtube: boolean;
  };
}

/**
 * Fetch Bluesky follower stats
 */
async function fetchBlueskyStats(blueskyHandle: string): Promise<{
  followers: number;
  following: number;
} | null> {
  try {
    console.log(`[Aggregate] Fetching Bluesky stats for @${blueskyHandle}...`);

    // Use the Bluesky API to get profile stats
    // Note: This requires the AT Protocol public API
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${blueskyHandle}`
    );

    if (!response.ok) {
      console.warn(`[Aggregate] Bluesky API error for @${blueskyHandle}:`, response.status);
      return null;
    }

    const data = await response.json();
    return {
      followers: data.followersCount || 0,
      following: data.followsCount || 0,
    };
  } catch (error) {
    console.error(`[Aggregate] Failed to fetch Bluesky stats for @${blueskyHandle}:`, error);
    return null;
  }
}

/**
 * Fetch YouTube subscriber count
 */
async function fetchYouTubeStats(channelId: string): Promise<{
  subscribers: number;
} | null> {
  try {
    console.log(`[Aggregate] Fetching YouTube stats for channel ${channelId}...`);
    const stats = await getChannelStats(channelId);

    if (!stats) {
      return null;
    }

    return {
      subscribers: stats.subscriberCount,
    };
  } catch (error) {
    console.error(`[Aggregate] Failed to fetch YouTube stats for ${channelId}:`, error);
    return null;
  }
}

/**
 * Aggregate follower counts from all connected platforms
 */
export async function aggregateFollowerStats(creator: {
  dragverseFollowerCount?: number;
  dragverseFollowingCount?: number;
  blueskyHandle?: string;
  blueskyFollowerCount?: number;
  blueskyFollowingCount?: number;
  youtubeChannelId?: string;
  youtubeFollowerCount?: number;
}): Promise<AggregatedStats> {
  console.log("[Aggregate] Starting follower aggregation...");

  // Start with Dragverse stats (cached in database)
  let dragverseFollowers = creator.dragverseFollowerCount || 0;
  let dragverseFollowing = creator.dragverseFollowingCount || 0;
  let blueskyFollowers = creator.blueskyFollowerCount || 0;
  let blueskyFollowing = creator.blueskyFollowingCount || 0;
  let youtubeSubscribers = creator.youtubeFollowerCount || 0;

  const platforms = {
    dragverse: dragverseFollowers > 0,
    bluesky: false,
    youtube: false,
  };

  // Fetch fresh Bluesky stats if handle is connected
  if (creator.blueskyHandle) {
    const blueskyStats = await fetchBlueskyStats(creator.blueskyHandle);
    if (blueskyStats) {
      blueskyFollowers = blueskyStats.followers;
      blueskyFollowing = blueskyStats.following;
      platforms.bluesky = true;
      console.log(`[Aggregate] Bluesky: ${blueskyFollowers} followers, ${blueskyFollowing} following`);
    }
  }

  // Fetch fresh YouTube stats if channel is connected
  if (creator.youtubeChannelId) {
    const youtubeStats = await fetchYouTubeStats(creator.youtubeChannelId);
    if (youtubeStats) {
      youtubeSubscribers = youtubeStats.subscribers;
      platforms.youtube = true;
      console.log(`[Aggregate] YouTube: ${youtubeSubscribers} subscribers`);
    }
  }

  // Calculate totals
  const totalFollowers = dragverseFollowers + blueskyFollowers + youtubeSubscribers;
  const totalFollowing = dragverseFollowing + blueskyFollowing;

  console.log(`[Aggregate] Total: ${totalFollowers} followers, ${totalFollowing} following`);

  return {
    totalFollowers,
    totalFollowing,
    dragverseFollowers,
    dragverseFollowing,
    blueskyFollowers,
    blueskyFollowing,
    youtubeSubscribers,
    lastUpdated: new Date(),
    platforms,
  };
}

/**
 * Format large numbers for display (e.g., 1.2K, 5.3M)
 */
export function formatFollowerCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`;
  } else {
    return `${(count / 1000000).toFixed(1)}M`;
  }
}
