import { supabase, getSupabaseServerClient } from './client';

// ============================================
// FOLLOW OPERATIONS
// ============================================

export async function followUser(followerDID: string, followingDID: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('follows')
    .insert({
      follower_did: followerDID,
      following_did: followingDID,
      source: 'dragverse',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unfollowUser(followerDID: string, followingDID: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_did', followerDID)
    .eq('following_did', followingDID)
    .eq('source', 'dragverse');

  if (error) throw error;
}

export async function isFollowing(followerDID: string, followingDID: string): Promise<boolean> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return false;
  }

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_did', followerDID)
    .eq('following_did', followingDID)
    .maybeSingle();

  return !!data;
}

export async function getFollowers(userDID: string, limit = 50) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('follows')
    .select('follower_did, created_at')
    .eq('following_did', userDID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getFollowing(userDID: string, limit = 50) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('follows')
    .select('following_did, created_at')
    .eq('follower_did', userDID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================
// LIKE OPERATIONS
// ============================================

export async function likeVideo(userDID: string, videoId: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('likes')
    .insert({
      user_did: userDID,
      video_id: videoId,
      source: 'dragverse',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlikeVideo(userDID: string, videoId: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_did', userDID)
    .eq('video_id', videoId);

  if (error) throw error;
}

export async function hasLikedVideo(userDID: string, videoId: string): Promise<boolean> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return false;
  }

  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_did', userDID)
    .eq('video_id', videoId)
    .maybeSingle();

  return !!data;
}

export async function getVideoLikes(videoId: string, limit = 50) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('likes')
    .select('user_did, created_at')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================
// COMMENT OPERATIONS
// ============================================

export interface Comment {
  id: string;
  video_id: string;
  author_did: string;
  content: string;
  parent_comment_id?: string;
  likes: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function createComment(input: {
  videoId: string;
  authorDID: string;
  content: string;
  parentCommentId?: string;
}) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      video_id: input.videoId,
      author_did: input.authorDID,
      content: input.content,
      parent_comment_id: input.parentCommentId,
      source: 'dragverse',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Comment;
}

export async function getComments(videoId: string, limit = 50): Promise<Comment[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('video_id', videoId)
    .is('parent_comment_id', null) // Only top-level comments
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Comment[]) || [];
}

export async function getReplies(parentCommentId: string, limit = 50): Promise<Comment[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('parent_comment_id', parentCommentId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as Comment[]) || [];
}

export async function deleteComment(commentId: string, authorDID: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_did', authorDID); // Ensure only author can delete

  if (error) throw error;
}
