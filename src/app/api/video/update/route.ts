import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/video/update
 * Update video metadata (title, description, thumbnail, etc.)
 */
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userDID = auth.userId;

    // Parse request body
    const body = await request.json();
    const {
      videoId,
      title,
      description,
      thumbnail,
      category,
      tags,
      visibility,
      livepeerAssetId,
      playbackId,
      playbackUrl,
    } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Check if video exists and user owns it
    const { data: existingVideo, error: fetchError } = await supabase
      .from("videos")
      .select("id, creator_did")
      .eq("id", videoId)
      .single();

    if (fetchError || !existingVideo) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (existingVideo.creator_did !== userDID) {
      return NextResponse.json(
        { error: "You don't have permission to edit this video" },
        { status: 403 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (visibility !== undefined) updateData.visibility = visibility;
    if (livepeerAssetId !== undefined) updateData.livepeer_asset_id = livepeerAssetId;
    if (playbackId !== undefined) updateData.playback_id = playbackId;
    if (playbackUrl !== undefined) updateData.playback_url = playbackUrl;

    // Update video in Supabase
    const { data: updatedVideo, error: updateError } = await supabase
      .from("videos")
      .update(updateData)
      .eq("id", videoId)
      .select()
      .single();

    if (updateError) {
      console.error("[Video Update] Supabase error:", updateError);
      return NextResponse.json(
        { error: "Failed to update video", details: updateError.message },
        { status: 500 }
      );
    }

    console.log("[Video Update] ✅ Video updated successfully:", videoId);
    return NextResponse.json({
      success: true,
      video: updatedVideo,
      message: "Video updated successfully",
    });
  } catch (error) {
    console.error("[Video Update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}
