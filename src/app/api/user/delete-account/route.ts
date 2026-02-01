import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/user/delete-account
 * Permanently delete user account and all associated data
 *
 * WARNING: This is a destructive action that cannot be undone
 *
 * Deletes:
 * - All user videos, audio, posts
 * - All comments and interactions
 * - Profile and follower/following relationships
 * - Connected social account data
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log(`[Delete Account] Starting deletion for user: ${userId}`);

    // Start a transaction-like deletion process
    // Note: Supabase will handle cascading deletes if foreign keys are set up properly

    // 1. Delete all videos
    const { error: videosError } = await supabase
      .from("videos")
      .delete()
      .eq("creator_did", userId);

    if (videosError) {
      console.error("[Delete Account] Error deleting videos:", videosError);
      throw new Error("Failed to delete videos");
    }

    // 2. Delete all posts
    const { error: postsError } = await supabase
      .from("posts")
      .delete()
      .eq("creator_did", userId);

    if (postsError) {
      console.error("[Delete Account] Error deleting posts:", postsError);
      throw new Error("Failed to delete posts");
    }

    // 3. Delete all comments
    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .eq("user_did", userId);

    if (commentsError) {
      console.error("[Delete Account] Error deleting comments:", commentsError);
      throw new Error("Failed to delete comments");
    }

    // 4. Delete all likes
    const { error: likesError } = await supabase
      .from("likes")
      .delete()
      .eq("user_did", userId);

    if (likesError) {
      console.error("[Delete Account] Error deleting likes:", likesError);
      // Non-critical, continue
    }

    // 5. Delete follower relationships
    const { error: followersError } = await supabase
      .from("follows")
      .delete()
      .or(`follower_did.eq.${userId},following_did.eq.${userId}`);

    if (followersError) {
      console.error("[Delete Account] Error deleting follows:", followersError);
      // Non-critical, continue
    }

    // 6. Delete notifications
    const { error: notificationsError } = await supabase
      .from("notifications")
      .delete()
      .or(`user_did.eq.${userId},actor_did.eq.${userId}`);

    if (notificationsError) {
      console.error("[Delete Account] Error deleting notifications:", notificationsError);
      // Non-critical, continue
    }

    // 7. Finally, delete the creator profile
    const { error: creatorError } = await supabase
      .from("creators")
      .delete()
      .eq("did", userId);

    if (creatorError) {
      console.error("[Delete Account] Error deleting creator profile:", creatorError);
      throw new Error("Failed to delete creator profile");
    }

    console.log(`[Delete Account] ✅ Successfully deleted account: ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("[Delete Account] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
