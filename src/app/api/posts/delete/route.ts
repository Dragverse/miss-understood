import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * DELETE /api/posts/delete
 * Delete a post (only the creator can delete their own posts)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 500 }
      );
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // First verify the post belongs to this user
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("id, creator_did")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (post.creator_did !== auth.userId) {
      return NextResponse.json(
        { error: "You can only delete your own posts" },
        { status: 403 }
      );
    }

    // Delete the post
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (deleteError) {
      console.error("Failed to delete post:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete post" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Post deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
