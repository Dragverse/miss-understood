import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * Get related videos/audio based on content type and category
 * @route GET /api/video/related?videoId=X&contentType=Y&limit=Z
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");
    const contentType = searchParams.get("contentType");
    const limit = parseInt(searchParams.get("limit") || "6");

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Get the video's category first
    const { data: currentVideo, error: videoError } = await supabase
      .from("videos")
      .select("category, content_type")
      .eq("id", videoId)
      .single();

    if (videoError || !currentVideo) {
      console.error("[RelatedVideos] Failed to get current video:", videoError);
      return NextResponse.json({ videos: [] });
    }

    // Build query to find similar videos
    let query = supabase
      .from("videos")
      .select(`
        id,
        title,
        description,
        thumbnail,
        duration,
        views,
        likes,
        created_at,
        playback_url,
        livepeer_asset_id,
        content_type,
        category,
        tags,
        visibility,
        creator_did
      `)
      .eq("visibility", "public") // Only show public videos
      .neq("id", videoId) // Exclude current video
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by content type if provided, otherwise use current video's type
    const filterContentType = contentType || currentVideo.content_type;
    if (filterContentType) {
      query = query.eq("content_type", filterContentType);
    }

    // Prefer same category
    if (currentVideo.category) {
      query = query.eq("category", currentVideo.category);
    }

    const { data: videos, error } = await query;

    if (error) {
      console.error("[RelatedVideos] Query error:", error);
      return NextResponse.json({ videos: [] });
    }

    // If we didn't get enough results with same category, fetch more without category filter
    if (videos && videos.length < limit && currentVideo.category) {
      const remainingLimit = limit - videos.length;

      const { data: moreVideos } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          description,
          thumbnail,
          duration,
          views,
          likes,
          created_at,
          playback_url,
          livepeer_asset_id,
          content_type,
          category,
          tags,
          visibility,
          creator_did
        `)
        .eq("visibility", "public")
        .neq("id", videoId)
        .eq("content_type", filterContentType)
        .neq("category", currentVideo.category) // Different category this time
        .order("created_at", { ascending: false })
        .limit(remainingLimit);

      if (moreVideos) {
        videos.push(...moreVideos);
      }
    }

    return NextResponse.json({ videos: videos || [] });
  } catch (error) {
    console.error("[RelatedVideos] Unexpected error:", error);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
