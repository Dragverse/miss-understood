import type { Creator as SupabaseCreator } from './creators';
import type { SupabaseVideo } from './videos';
import type { Creator, Video } from '@/types';

/**
 * Transform Supabase Creator to global Creator type
 */
export function transformSupabaseCreator(creator: SupabaseCreator): Creator {
  return {
    did: creator.did,
    handle: creator.handle,
    displayName: creator.display_name,
    avatar: creator.avatar || "/defaultpfp.png",
    banner: creator.banner,
    description: creator.description || '',
    website: creator.website,
    twitterHandle: creator.twitter_handle,
    instagramHandle: creator.instagram_handle,
    tiktokHandle: creator.tiktok_handle,
    blueskyHandle: creator.bluesky_handle,
    blueskyDID: creator.bluesky_did,
    farcasterHandle: creator.farcaster_handle,
    youtubeChannelId: creator.youtube_channel_id,
    youtubeChannelName: creator.youtube_channel_name,
    youtubeSubscriberCount: creator.youtube_subscriber_count || 0,
    youtubeSyncedAt: creator.youtube_synced_at ? new Date(creator.youtube_synced_at) : undefined,
    youtubeVerified: creator.youtube_verified || false,
    youtubeVerificationCode: creator.youtube_verification_code || undefined,
    followerCount: creator.follower_count,
    followingCount: creator.following_count,
    dragverseFollowerCount: creator.dragverse_follower_count,
    blueskyFollowerCount: creator.bluesky_follower_count,
    verified: creator.verified,
    totalEarningsUSD: creator.total_earnings_usd,
    stripeAccountId: creator.stripe_account_id,
    walletAddress: creator.wallet_address,
    createdAt: new Date(creator.created_at),
    updatedAt: new Date(creator.updated_at),
  };
}

/**
 * Transform Supabase Video to global Video type
 */
export function transformSupabaseVideo(video: SupabaseVideo, creator?: Creator): Video {
  return {
    id: video.id,
    title: video.title,
    description: video.description || '',
    thumbnail: video.thumbnail || '',
    duration: video.duration || 0,
    views: video.views,
    likes: video.likes,
    createdAt: new Date(video.created_at),
    playbackUrl: video.playback_url || '',
    // Use playback_id first (this is the actual playback ID), fallback to livepeer_asset_id
    livepeerAssetId: video.playback_id || video.livepeer_asset_id || '',
    contentType: video.content_type as any || 'long',
    creator: creator || ({} as Creator),
    category: video.category || '',
    tags: video.tags || [],
    source: 'ceramic' as const,
  };
}
