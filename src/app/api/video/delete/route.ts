import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * DELETE /api/video/delete
 * Delete a video (only creator can delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    let userDID = "anonymous";

    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userDID = auth.userId || "anonymous";
    }

    // Get video ID from request body
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Check if user owns the video
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("creator_did")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.creator_did !== userDID) {
      return NextResponse.json({ error: "You can only delete your own videos" }, { status: 403 });
    }

    // Delete the video
    const { error: deleteError } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Video deleted successfully"
    });
  } catch (error) {
    console.error("Video deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
