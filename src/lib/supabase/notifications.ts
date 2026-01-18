import { supabase, getSupabaseServerClient } from './client';

export interface Notification {
  id: string;
  recipient_did: string;
  sender_did?: string;
  type: 'like' | 'comment' | 'follow' | 'tip' | 'mention' | 'repost';
  source: 'dragverse' | 'bluesky';
  source_id?: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export async function createNotification(input: {
  recipientDID: string;
  senderDID?: string;
  type: Notification['type'];
  source: 'dragverse' | 'bluesky';
  sourceId?: string;
  message: string;
  link?: string;
}) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      recipient_did: input.recipientDID,
      sender_did: input.senderDID,
      type: input.type,
      source: input.source,
      source_id: input.sourceId,
      message: input.message,
      link: input.link,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}

export async function getNotifications(userDID: string, limit = 50): Promise<Notification[]> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_did', userDID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Notification[]) || [];
}

export async function getUnreadCount(userDID: string): Promise<number> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return 0;
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_did', userDID)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(userDID: string) {
  if (!supabase) {
    console.warn('Supabase not configured');
    return;
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_did', userDID)
    .eq('read', false);

  if (error) throw error;
}

// Helper to aggregate Dragverse + Bluesky notifications
export async function getAggregatedNotifications(
  userDID: string,
  blueskyNotifications: any[] = [],
  limit = 50
): Promise<Notification[]> {
  // Get Dragverse notifications from Supabase
  const dragverseNotifs = await getNotifications(userDID, limit);

  // Transform Bluesky notifications to match format
  const blueskyTransformed: Notification[] = blueskyNotifications.map((n) => ({
    id: n.uri || n.cid,
    recipient_did: userDID,
    sender_did: n.author?.did,
    type: (n.reason === 'like' ? 'like' : n.reason === 'follow' ? 'follow' : 'mention') as Notification['type'],
    source: 'bluesky' as const,
    source_id: n.uri,
    message: `${n.author?.displayName || n.author?.handle} ${n.reason}d your post`,
    link: n.uri,
    read: n.isRead || false,
    created_at: n.indexedAt || new Date().toISOString(),
  }));

  // Merge and sort by date
  const allNotifs = [...dragverseNotifs, ...blueskyTransformed]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return allNotifs;
}
