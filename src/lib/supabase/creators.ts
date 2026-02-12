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
  youtube_channel_id?: string;
  youtube_channel_name?: string;
  youtube_subscriber_count?: number;
  youtube_synced_at?: string;
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

  console.log('[createOrUpdateCreator] Input:', {
    did: input.did,
    handle: input.handle,
    display_name: input.display_name
  });

  // Use upsert to handle both insert and update in one operation
  // This is simpler and more reliable than separate insert/update logic
  const { data, error } = await client
    .from('creators')
    .upsert({
      did: input.did!,
      handle: input.handle!,
      display_name: input.display_name!,
      avatar: input.avatar || '',
      banner: input.banner || '',
      description: input.description || '',
      website: input.website || '',
      twitter_handle: input.twitter_handle || '',
      instagram_handle: input.instagram_handle || '',
      tiktok_handle: input.tiktok_handle || '',
      bluesky_handle: input.bluesky_handle || '',
      bluesky_did: input.bluesky_did || '',
      farcaster_handle: input.farcaster_handle || '',
    }, {
      onConflict: 'did', // Use DID as the unique constraint for upsert
      ignoreDuplicates: false, // Update if exists
    })
    .select()
    .single();

  if (error) {
    console.error('[createOrUpdateCreator] Failed:', error);
    throw error;
  }

  console.log('[createOrUpdateCreator] Success:', data.id);
  return data as Creator;
}

export async function getCreatorByDID(did: string): Promise<Creator | null> {
  // Use server client for API routes, fall back to regular client for client-side
  const client = typeof window === 'undefined' ? getSupabaseServerClient() : supabase;

  if (!client) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await client
    .from('creators')
    .select('*')
    .eq('did', did)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data as Creator | null;
}

export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  // Use server client for API routes, fall back to regular client for client-side
  const client = typeof window === 'undefined' ? getSupabaseServerClient() : supabase;

  if (!client) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await client
    .from('creators')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Creator | null;
}

/**
 * Try to find a creator by handle first, then by DID if not found.
 * This allows /u/ links to work with both handles and DIDs.
 */
export async function getCreatorByHandleOrDID(identifier: string): Promise<Creator | null> {
  // First try by handle (most common case)
  const byHandle = await getCreatorByHandle(identifier);
  if (byHandle) return byHandle;

  // If identifier looks like a DID, try that
  if (identifier.startsWith('did:')) {
    return await getCreatorByDID(identifier);
  }

  // Also try case-insensitive handle search
  const client = typeof window === 'undefined' ? getSupabaseServerClient() : supabase;
  if (!client) return null;

  const { data, error } = await client
    .from('creators')
    .select('*')
    .ilike('handle', identifier)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') return null;
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
