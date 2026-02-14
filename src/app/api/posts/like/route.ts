import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { postId, action } = await request.json();

    if (!postId || !action || !['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    const userDID = auth.userId;

    if (action === 'like') {
      // Insert like (ignore if already exists)
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          creator_did: userDID,
        })
        .select()
        .single();

      if (error && error.code !== '23505') { // 23505 = unique violation (already liked)
        throw error;
      }

      // Increment like count on post
      await supabase.rpc('increment_post_likes', { post_id: postId });

    } else {
      // Delete like
      await supabase
        .from('post_likes')
        .delete()
        .match({ post_id: postId, creator_did: userDID });

      // Decrement like count on post
      await supabase.rpc('decrement_post_likes', { post_id: postId });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Post like error:', error);
    return NextResponse.json(
      { error: 'Failed to process like' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user liked a post
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ liked: false });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .match({ post_id: postId, creator_did: auth.userId })
      .single();

    return NextResponse.json({ liked: !!data });
  } catch (error) {
    return NextResponse.json({ liked: false });
  }
}
