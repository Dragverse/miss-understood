import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Batch endpoint to check like/follow status for multiple items at once
 * Reduces N API calls to 1, significantly lowering egress usage
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication (optional - returns empty results for unauthenticated)
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({
        likes: {},
        follows: {},
        message: 'Authentication required'
      });
    }

    const { videoIds = [], creatorDIDs = [] } = await request.json();

    // Initialize result maps
    const likes: Record<string, boolean> = {};
    const follows: Record<string, boolean> = {};

    // Batch query likes for all videos
    if (videoIds.length > 0) {
      const { data: likeData } = await supabase
        .from('video_likes')
        .select('video_id')
        .eq('creator_did', auth.userId)
        .in('video_id', videoIds);

      // Convert array to map
      likeData?.forEach((like) => {
        likes[like.video_id] = true;
      });

      // Fill in false for videos not liked
      videoIds.forEach((id: string) => {
        if (!(id in likes)) {
          likes[id] = false;
        }
      });
    }

    // Batch query follows for all creators
    if (creatorDIDs.length > 0) {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_did')
        .eq('follower_did', auth.userId)
        .in('following_did', creatorDIDs);

      // Convert array to map
      followData?.forEach((follow) => {
        follows[follow.following_did] = true;
      });

      // Fill in false for creators not followed
      creatorDIDs.forEach((did: string) => {
        if (!(did in follows)) {
          follows[did] = false;
        }
      });
    }

    return NextResponse.json({
      success: true,
      likes,
      follows,
    });
  } catch (error) {
    console.error('Batch check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check social status',
        likes: {},
        follows: {},
      },
      { status: 500 }
    );
  }
}
