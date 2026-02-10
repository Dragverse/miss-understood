import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { followUser, unfollowUser, isFollowing } from '@/lib/supabase/social';
import { createNotification } from '@/lib/supabase/notifications';
import { getCreatorByDID } from '@/lib/supabase/creators';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify authentication to prevent user spoofing
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { followingDID, action } = await request.json();

    if (!followingDID) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use authenticated user's DID as follower
    const followerDID = auth.userId;

    // Prevent self-follow
    if (followerDID === followingDID) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
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

export async function GET(request: NextRequest) {
  // SECURITY: Require authentication to prevent relationship enumeration
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const followingDID = searchParams.get('followingDID');

  if (!followingDID) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Only allow checking current user's follows
    const following = await isFollowing(auth.userId, followingDID);
    return NextResponse.json({ following });
  } catch (error) {
    console.error('Check following error:', error);
    return NextResponse.json(
      { error: 'Failed to check follow status' },
      { status: 500 }
    );
  }
}
