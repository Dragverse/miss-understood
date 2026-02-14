import { NextRequest, NextResponse } from 'next/server';
import { createComment, getComments, getReplies } from '@/lib/supabase/social';
import { createNotification } from '@/lib/supabase/notifications';
import { getVideo } from '@/lib/supabase/videos';
import { getCreatorByDID } from '@/lib/supabase/creators';
import { verifyAuth, isPrivyConfigured } from '@/lib/auth/verify';

export async function POST(request: NextRequest) {
  try {
    console.log("[Comment API] Creating comment...");

    // SECURITY: ALWAYS require authentication (fail-closed)
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: 'Authentication required to comment' },
        { status: 401 }
      );
    }

    const { videoId, content, parentCommentId } = await request.json();

    if (!videoId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use authenticated user's DID, not client-provided value
    const authorDID = auth.userId;

    const comment = await createComment({
      videoId,
      authorDID,
      content,
      parentCommentId,
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Supabase not configured or comment creation failed' },
        { status: 503 }
      );
    }

    // Create notification for video creator
    try {
      const video = await getVideo(videoId);
      const commenter = await getCreatorByDID(authorDID);

      if (video && video.creator_did !== authorDID && comment) {
        await createNotification({
          recipientDID: video.creator_did,
          senderDID: authorDID,
          type: 'comment',
          source: 'dragverse',
          sourceId: comment.id,
          message: `${commenter?.display_name || 'Someone'} commented on your video "${video.title}"`,
          link: `/watch/${videoId}#comment-${comment.id}`,
        });
      }
    } catch (notifError) {
      console.error('Failed to create comment notification:', notifError);
      // Don't fail the comment creation if notification fails
    }

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error('Comment error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const parentCommentId = searchParams.get('parentCommentId');

  if (!videoId && !parentCommentId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    let comments;
    if (parentCommentId) {
      comments = await getReplies(parentCommentId);
    } else {
      comments = await getComments(videoId!);
    }

    // Enrich comments with author data
    const enrichedComments = await Promise.all(
      comments.map(async (comment: any) => {
        const author = await getCreatorByDID(comment.author_did);
        return {
          ...comment,
          author: author ? {
            display_name: author.display_name,
            handle: author.handle,
            avatar: author.avatar || '/defaultpfp.png',
          } : {
            display_name: 'Dragverse User',
            handle: `user-${comment.author_did.substring(0, 8)}`,
            avatar: '/defaultpfp.png',
          }
        };
      })
    );

    return NextResponse.json({ comments: enrichedComments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
