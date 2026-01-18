import { supabase, getSupabaseServerClient } from './client';

export interface Creator {
  id: string;
  did: string;
  handle: string;
  display_name: string;
  avatar?: string;
  banner?: string;
  description?: string;
  website?: string;
  twitter_handle?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  bluesky_handle?: string;
  bluesky_did?: string;
  farcaster_handle?: string;
  follower_count: number;
  following_count: number;
  dragverse_follower_count: number;
  bluesky_follower_count: number;
  verified: boolean;
  total_earnings_usd: number;
  stripe_account_id?: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export type CreateCreatorInput = Partial<Omit<Creator, 'id' | 'created_at' | 'updated_at' | 'follower_count' | 'following_count' | 'dragverse_follower_count' | 'bluesky_follower_count' | 'total_earnings_usd' | 'verified'>>;

export async function createOrUpdateCreator(input: CreateCreatorInput) {
  const client = getSupabaseServerClient();

  // Try to find existing creator by DID
  const { data: existing, error: fetchError } = await client
    .from('creators')
    .select('*')
    .eq('did', input.did)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    // Update existing
    const { data, error } = await client
      .from('creators')
      .update({
        display_name: input.display_name,
        avatar: input.avatar,
        banner: input.banner,
        description: input.description,
        website: input.website,
        twitter_handle: input.twitter_handle,
        instagram_handle: input.instagram_handle,
        tiktok_handle: input.tiktok_handle,
        bluesky_handle: input.bluesky_handle,
        bluesky_did: input.bluesky_did,
        farcaster_handle: input.farcaster_handle,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as Creator;
  } else {
    // Create new
    const { data, error } = await client
      .from('creators')
      .insert({
        did: input.did!,
        handle: input.handle!,
        display_name: input.display_name!,
        avatar: input.avatar,
        banner: input.banner,
        description: input.description,
        website: input.website,
        twitter_handle: input.twitter_handle,
        instagram_handle: input.instagram_handle,
        tiktok_handle: input.tiktok_handle,
        bluesky_handle: input.bluesky_handle,
        bluesky_did: input.bluesky_did,
        farcaster_handle: input.farcaster_handle,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Creator;
  }
}

export async function getCreatorByDID(did: string): Promise<Creator | null> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('did', did)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data as Creator | null;
}

export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Creator | null;
}

export async function searchCreators(searchTerm: string, limit = 20): Promise<Creator[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .or(`handle.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) throw error;
  return (data as Creator[]) || [];
}

export async function getAllCreators(limit = 50): Promise<Creator[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Creator[]) || [];
}
