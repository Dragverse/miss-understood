import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * POST /api/posts/comment
 * Create a comment on a Dragverse post
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required to comment" },
        { status: 401 }
      );
    }

    const { postId, content, parentCommentId } = await request.json();

    if (!postId || !content?.trim()) {
      return NextResponse.json(
        { error: "Post ID and comment content are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const creatorDid = auth.userId;

    // Look up creator record for the commenter
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", creatorDid)
      .single();

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        creator_id: creator?.id || null,
        creator_did: creatorDid,
        text_content: content.trim(),
        parent_comment_id: parentCommentId || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Post Comment] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Increment comment count on the post (best-effort, don't fail if RPC missing)
    try {
      await supabase.rpc("increment_post_comments", { post_uuid: postId });
    } catch {
      // RPC may not exist yet — ignore
    }

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("[Post Comment] Error:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posts/comment?postId=xxx
 * Get comments for a Dragverse post
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: comments, error } = await supabase
      .from("post_comments")
      .select(`
        *,
        creator:creators!post_comments_creator_id_fkey(
          display_name,
          handle,
          avatar
        )
      `)
      .eq("post_id", postId)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Post Comment] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Add fallback for missing creator data
    const enrichedComments = (comments || []).map((c: any) => ({
      ...c,
      creator: c.creator || {
        display_name: "Dragverse User",
        handle: `user-${c.creator_did.substring(0, 8)}`,
        avatar: "/defaultpfp.png",
      },
    }));

    return NextResponse.json({ success: true, comments: enrichedComments });
  } catch (error) {
    console.error("[Post Comment] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
