/**
 * Utility to transform Supabase videos to frontend Video type with creator data
 */

import { SupabaseVideo } from './videos';
import { getCreatorByDID } from './creators';
import type { Video } from '@/types';

const PLACEHOLDER_IMAGE = '/default-thumbnail.jpg';

/**
 * Transform a single Supabase video to Video type with creator data
 */
export async function transformVideoWithCreator(supabaseVideo: SupabaseVideo): Promise<Video> {
  // Fetch creator data
  let creatorData;
  try {
    const creator = await getCreatorByDID(supabaseVideo.creator_did);
    if (creator) {
      console.log('[transformVideo] Creator wallet_address from DB:', creator.wallet_address);
      creatorData = {
        did: creator.did,
        handle: creator.handle,
        displayName: creator.display_name,
        avatar: creator.avatar || "/defaultpfp.png",
        description: creator.description || '',
        followerCount: creator.follower_count || 0,
        followingCount: creator.following_count || 0,
        createdAt: new Date(creator.created_at),
        verified: creator.verified || false,
        walletAddress: creator.wallet_address,
      };
      console.log('[transformVideo] CreatorData walletAddress:', creatorData.walletAddress);
    }
  } catch (error) {
    console.warn('[transformVideo] Failed to fetch creator:', error);
  }

  // Fallback creator data if fetch failed
  if (!creatorData) {
    creatorData = {
      did: supabaseVideo.creator_did,
      handle: `user-${supabaseVideo.creator_did.substring(0, 8)}`,
      displayName: 'Dragverse User',
      avatar: "/defaultpfp.png",
      description: '',
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: false,
    };
  }

  return {
    id: supabaseVideo.id,
    title: supabaseVideo.title,
    description: supabaseVideo.description || '',
    thumbnail: supabaseVideo.thumbnail || PLACEHOLDER_IMAGE,
    duration: supabaseVideo.duration || 0,
    views: supabaseVideo.views,
    likes: supabaseVideo.likes,
    createdAt: new Date(supabaseVideo.created_at),
    playbackUrl: supabaseVideo.playback_url || '',
    livepeerAssetId: supabaseVideo.livepeer_asset_id || '',
    contentType: supabaseVideo.content_type || 'long',
    creator: creatorData,
    category: supabaseVideo.category || 'Other',
    tags: supabaseVideo.tags || [],
    source: 'ceramic' as const,
  };
}

/**
 * Transform multiple Supabase videos to Video type with creator data
 */
export async function transformVideosWithCreators(supabaseVideos: SupabaseVideo[]): Promise<Video[]> {
  // Fetch all unique creators in parallel
  const uniqueDids = [...new Set(supabaseVideos.map(v => v.creator_did))];

  const creatorsMap = new Map();
  await Promise.all(
    uniqueDids.map(async (did) => {
      try {
        const creator = await getCreatorByDID(did);
        if (creator) {
          creatorsMap.set(did, {
            did: creator.did,
            handle: creator.handle,
            displayName: creator.display_name,
            avatar: creator.avatar || "/defaultpfp.png",
            description: creator.description || '',
            followerCount: creator.follower_count || 0,
            followingCount: creator.following_count || 0,
            createdAt: new Date(creator.created_at),
            verified: creator.verified || false,
            walletAddress: creator.wallet_address,
          });
        }
      } catch (error) {
        console.warn(`[transformVideos] Failed to fetch creator ${did}:`, error);
      }
    })
  );

  // Transform videos
  return supabaseVideos.map((v) => {
    const creator = creatorsMap.get(v.creator_did) || {
      did: v.creator_did,
      handle: `user-${v.creator_did.substring(0, 8)}`,
      displayName: 'Dragverse User',
      avatar: "/defaultpfp.png",
      description: '',
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date(),
      verified: false,
    };

    return {
      id: v.id,
      title: v.title,
      description: v.description || '',
      thumbnail: v.thumbnail || PLACEHOLDER_IMAGE,
      duration: v.duration || 0,
      views: v.views,
      likes: v.likes,
      createdAt: new Date(v.created_at),
      playbackUrl: v.playback_url || '',
      livepeerAssetId: v.livepeer_asset_id || '',
      contentType: v.content_type || 'long',
      creator,
      category: v.category || 'Other',
      tags: v.tags || [],
      source: 'ceramic' as const,
    };
  });
}
