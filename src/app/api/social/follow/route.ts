import { NextResponse } from 'next/server';
import { followUser, unfollowUser, isFollowing } from '@/lib/supabase/social';
import { createNotification } from '@/lib/supabase/notifications';
import { getCreatorByDID } from '@/lib/supabase/creators';

export async function POST(request: Request) {
  try {
    const { followerDID, followingDID, action } = await request.json();

    if (!followerDID || !followingDID) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'follow') {
      await followUser(followerDID, followingDID);

      // Create notification for followed user
      try {
        const follower = await getCreatorByDID(followerDID);
        await createNotification({
          recipientDID: followingDID,
          senderDID: followerDID,
          type: 'follow',
          source: 'dragverse',
          message: `${follower?.display_name || 'Someone'} followed you`,
          link: `/profile/${follower?.handle}`,
        });
      } catch (notifError) {
        console.error('Failed to create follow notification:', notifError);
        // Don't fail the follow action if notification creation fails
      }

      return NextResponse.json({ success: true, following: true });
    } else if (action === 'unfollow') {
      await unfollowUser(followerDID, followingDID);
      return NextResponse.json({ success: true, following: false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json(
      { error: 'Failed to process follow action' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const followerDID = searchParams.get('followerDID');
  const followingDID = searchParams.get('followingDID');

  if (!followerDID || !followingDID) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const following = await isFollowing(followerDID, followingDID);
    return NextResponse.json({ following });
  } catch (error) {
    console.error('Check following error:', error);
    return NextResponse.json(
      { error: 'Failed to check follow status' },
      { status: 500 }
    );
  }
}
