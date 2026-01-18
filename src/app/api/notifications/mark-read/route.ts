import { NextResponse } from 'next/server';
import { markAsRead, markAllAsRead } from '@/lib/supabase/notifications';

export async function POST(request: Request) {
  try {
    const { notificationId, userDID, markAll } = await request.json();

    if (markAll && userDID) {
      await markAllAsRead(userDID);
      return NextResponse.json({ success: true });
    } else if (notificationId) {
      await markAsRead(notificationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
