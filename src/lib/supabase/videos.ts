import { supabase, getSupabaseServerClient } from './client';

export interface SupabaseVideo {
  id: string;
  creator_id: string;
  creator_did: string;
  title: string;
  description?: string;
  thumbnail?: string;
  livepeer_asset_id?: string;
  playback_id?: string;
  playback_url?: string;
  duration?: number;
  content_type?: 'short' | 'long' | 'podcast' | 'music' | 'live';
  category?: string;
  tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
  views: number;
  likes: number;
  tip_count: number;
  total_tips_usd: number;
  created_at: string;
  published_at?: string;
  updated_at: string;
}

export type CreateVideoInput = Omit<SupabaseVideo, 'id' | 'creator_id' | 'views' | 'likes' | 'tip_count' | 'total_tips_usd' | 'created_at' | 'updated_at'>;

export async function createVideo(input: Partial<CreateVideoInput>) {
  const client = getSupabaseServerClient();

  // Look up creator_id from creator_did
  const { data: creator, error: creatorError } = await client
    .from('creators')
    .select('id')
    .eq('did', input.creator_did!)
    .maybeSingle();

  if (creatorError) {
    console.error('[createVideo] Failed to lookup creator:', creatorError);
    throw new Error(`Creator lookup failed: ${creatorError.message}`);
  }

  if (!creator) {
    console.error('[createVideo] No creator found for DID:', input.creator_did);
    throw new Error(`No creator found with DID: ${input.creator_did}`);
  }

  const { data, error } = await client
    .from('videos')
    .insert({
      creator_id: creator.id,
      creator_did: input.creator_did!,
      title: input.title!,
      description: input.description,
      thumbnail: input.thumbnail,
      livepeer_asset_id: input.livepeer_asset_id,
      playback_id: input.playback_id,
      playback_url: input.playback_url,
      duration: input.duration,
      content_type: input.content_type,
      category: input.category,
      tags: input.tags,
      visibility: input.visibility || 'public',
      published_at: input.published_at,
    })
    .select()
    .single();

  if (error) {
    console.error('[createVideo] Insert failed:', error);
    throw error;
  }

  console.log(`[CreateVideo] Video created successfully:`, {
    video_id: data.id,
    creator_id: data.creator_id,
    content_type: data.content_type,
    visibility: data.visibility,
    title: data.title,
  });

  // Verify video can be queried back
  const { data: verification } = await client
    .from('videos')
    .select('id, title, content_type')
    .eq('id', data.id)
    .single();

  if (!verification) {
    console.error(`[CreateVideo] Warning: Video insert succeeded but cannot query back video ${data.id}`);
  } else {
    console.log(`[CreateVideo] ✅ Verification successful: Video ${data.id} is queryable`);
  }

  return data as SupabaseVideo;
}

export async function getVideo(id: string): Promise<SupabaseVideo | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as SupabaseVideo | null;
}

export async function getVideos(limit = 50): Promise<SupabaseVideoWithCreator[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  // Try without JOIN first to see if there are any videos
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getVideos] Query error:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('[getVideos] No videos found in database');
    return [];
  }

  console.log(`[getVideos] Found ${data.length} videos, now fetching creator info...`);

  // OPTIMIZED: Batch fetch all creators in a single query instead of N+1
  // Extract unique creator_ids
  const uniqueCreatorIds = [...new Set(data.map((v: any) => v.creator_id).filter(Boolean))];

  let creatorsMap: Map<string, any> = new Map();

  if (uniqueCreatorIds.length > 0 && supabase) {
    const { data: creatorsData, error: creatorsError } = await supabase
      .from('creators')
      .select('id, did, handle, display_name, avatar, verified, bluesky_handle, bluesky_did, wallet_address')
      .in('id', uniqueCreatorIds);

    if (creatorsError) {
      console.warn('[getVideos] Failed to batch fetch creators:', creatorsError);
    } else if (creatorsData) {
      // Build a map for O(1) lookup
      creatorsData.forEach((creator: any) => {
        creatorsMap.set(creator.id, creator);
      });
      console.log(`[getVideos] Batch fetched ${creatorsData.length} creators in 1 query`);
    }
  }

  // Map creators to videos
  const videosWithCreators = data.map((video: any) => ({
    ...video,
    creator: video.creator_id ? creatorsMap.get(video.creator_id) || null : null
  }));

  console.log(`[getVideos] Successfully loaded ${videosWithCreators.length} videos with creator info (2 queries total)`);
  return videosWithCreators as SupabaseVideoWithCreator[];
}

export interface SupabaseVideoWithCreator extends SupabaseVideo {
  creator?: {
    id: string;
    did: string;
    handle: string;
    display_name: string;
    avatar?: string;
    verified: boolean;
    bluesky_handle?: string;
    bluesky_did?: string;
    wallet_address?: string;
  };
}

export async function getVideosByCreator(creatorDID: string, limit = 50): Promise<SupabaseVideoWithCreator[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  // Query videos first
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('*')
    .eq('creator_did', creatorDID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (videosError) {
    console.error('[getVideosByCreator] Error fetching videos:', videosError);
    throw videosError;
  }

  if (!videos || videos.length === 0) {
    console.log('[getVideosByCreator] No videos found for creator:', creatorDID);
    return [];
  }

  console.log(`[getVideosByCreator] Found ${videos.length} videos for creator ${creatorDID}`);

  // OPTIMIZED: Batch fetch all creators in a single query instead of N+1
  const uniqueCreatorIds = [...new Set(videos.map((v: any) => v.creator_id).filter(Boolean))];

  let creatorsMap: Map<string, any> = new Map();

  if (uniqueCreatorIds.length > 0 && supabase) {
    const { data: creatorsData, error: creatorsError } = await supabase
      .from('creators')
      .select('id, did, handle, display_name, avatar, verified, bluesky_handle, bluesky_did, wallet_address')
      .in('id', uniqueCreatorIds);

    if (creatorsError) {
      console.warn('[getVideosByCreator] Failed to batch fetch creators:', creatorsError);
    } else if (creatorsData) {
      creatorsData.forEach((creator: any) => {
        creatorsMap.set(creator.id, creator);
      });
    }
  }

  const videosWithCreators = videos.map((video: any) => ({
    ...video,
    creator: video.creator_id ? creatorsMap.get(video.creator_id) || null : null
  }));

  console.log(`[getVideosByCreator] Successfully loaded ${videosWithCreators.length} videos with creator info (2 queries total)`);
  return videosWithCreators as SupabaseVideoWithCreator[];
}

export async function getVideosByContentType(contentType: string, limit = 50): Promise<SupabaseVideo[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('content_type', contentType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SupabaseVideo[]) || [];
}

export async function incrementVideoViews(
  videoId: string,
  viewerDID?: string
) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return;
  }

  // Generate session ID if user not authenticated
  let sessionId = null;
  if (!viewerDID) {
    // Check if session ID exists in localStorage (client-side only)
    if (typeof window !== 'undefined') {
      sessionId = localStorage.getItem('viewer_session_id');
      if (!sessionId) {
        // Generate new session ID
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('viewer_session_id', sessionId);
      }
    }
  }

  const { error } = await supabase.rpc('increment_video_views', {
    video_id_param: videoId,
    viewer_did_param: viewerDID || null,
    viewer_session_param: sessionId
  });

  if (error) console.error('Failed to increment views:', error);
}
