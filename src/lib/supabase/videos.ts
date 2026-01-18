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

  const { data, error } = await client
    .from('videos')
    .insert({
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
      published_at: input.published_at,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SupabaseVideo;
}

export async function getVideo(id: string): Promise<SupabaseVideo | null> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as SupabaseVideo | null;
}

export async function getVideos(limit = 50): Promise<SupabaseVideo[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SupabaseVideo[]) || [];
}

export async function getVideosByCreator(creatorDID: string, limit = 50): Promise<SupabaseVideo[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('creator_did', creatorDID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SupabaseVideo[]) || [];
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

export async function incrementVideoViews(videoId: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return;
  }

  const { error } = await supabase.rpc('increment_video_views', { video_id: videoId });
  if (error) console.error('Failed to increment views:', error);
}
