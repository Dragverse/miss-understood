import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { likeVideo, unlikeVideo, hasLikedVideo } from '@/lib/supabase/social';
import { createNotification } from '@/lib/supabase/notifications';
import { getVideo } from '@/lib/supabase/videos';
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

    const { videoId, action } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use authenticated user's DID, not client-provided value
    const userDID = auth.userId;

    if (action === 'like') {
      await likeVideo(userDID, videoId);

      // Create notification for video creator
      try {
        const video = await getVideo(videoId);
        const liker = await getCreatorByDID(userDID);

        if (video && video.creator_did !== userDID) {
          await createNotification({
            recipientDID: video.creator_did,
            senderDID: userDID,
            type: 'like',
            source: 'dragverse',
            sourceId: videoId,
            message: `${liker?.display_name || 'Someone'} liked your video "${video.title}"`,
            link: `/watch/${videoId}`,
          });
        }
      } catch (notifError) {
        console.error('Failed to create like notification:', notifError);
        // Don't fail the like action if notification creation fails
      }

      return NextResponse.json({ success: true, liked: true });
    } else if (action === 'unlike') {
      await unlikeVideo(userDID, videoId);
      return NextResponse.json({ success: true, liked: false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { error: 'Failed to process like action' },
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
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Only allow checking current user's likes
    const liked = await hasLikedVideo(auth.userId, videoId);
    return NextResponse.json({ liked });
  } catch (error) {
    console.error('Check liked error:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}
