import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

const VIDEO_SELECT = `
  id,
  title,
  description,
  thumbnail,
  duration,
  views,
  likes,
  created_at,
  playback_url,
  playback_id,
  livepeer_asset_id,
  content_type,
  category,
  tags,
  visibility,
  creator_did,
  creator_id
`;

/**
 * Get related videos/audio based on content type and category
 * When creatorDid is provided, prioritizes same-creator content first (for audio queue)
 * @route GET /api/video/related?videoId=X&contentType=Y&limit=Z&creatorDid=W
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");
    const contentType = searchParams.get("contentType");
    const creatorDid = searchParams.get("creatorDid");
    const limit = parseInt(searchParams.get("limit") || "6");

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Get the video's category first
    const { data: currentVideo, error: videoError } = await supabase
      .from("videos")
      .select("category, content_type, creator_did")
      .eq("id", videoId)
      .single();

    if (videoError || !currentVideo) {
      console.error("[RelatedVideos] Failed to get current video:", videoError);
      return NextResponse.json({ videos: [] });
    }

    const filterContentType = contentType || currentVideo.content_type;
    const effectiveCreatorDid = creatorDid || currentVideo.creator_did;

    // Helper: batch-fetch creators and attach to videos
    async function attachCreators(videos: any[]) {
      const uniqueCreatorIds = [...new Set(videos.map(v => v.creator_id).filter(Boolean))];
      if (uniqueCreatorIds.length === 0) return videos;

      const { data: creatorsData } = await supabase
        .from("creators")
        .select("id, did, handle, display_name, avatar, verified")
        .in("id", uniqueCreatorIds);

      const creatorsMap = new Map();
      if (creatorsData) {
        creatorsData.forEach(c => creatorsMap.set(c.id, c));
      }

      return videos.map(v => ({
        ...v,
        creator: v.creator_id ? creatorsMap.get(v.creator_id) || null : null,
      }));
    }

    // When creatorDid is provided, use two-pass strategy:
    // 1. Same creator's other content (highest priority for audio queue)
    // 2. Other creators' content (fill remaining slots)
    if (creatorDid) {
      const allVideos: any[] = [];

      // Pass 1: Same creator, different video, same content type
      const { data: sameCreator } = await supabase
        .from("videos")
        .select(VIDEO_SELECT)
        .eq("visibility", "public")
        .neq("id", videoId)
        .eq("creator_did", effectiveCreatorDid)
        .eq("content_type", filterContentType)
        .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sameCreator) {
        allVideos.push(...sameCreator);
      }

      // Pass 2: Other creators, same content type (fill remaining)
      if (allVideos.length < limit) {
        const remaining = limit - allVideos.length;
        const existingIds = [videoId, ...allVideos.map(v => v.id)];

        const { data: otherCreators } = await supabase
          .from("videos")
          .select(VIDEO_SELECT)
          .eq("visibility", "public")
          .not("id", "in", `(${existingIds.join(",")})`)
          .neq("creator_did", effectiveCreatorDid)
          .eq("content_type", filterContentType)
          .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
          .order("created_at", { ascending: false })
          .limit(remaining);

        if (otherCreators) {
          allVideos.push(...otherCreators);
        }
      }

      const videosWithCreators = await attachCreators(allVideos);

      return NextResponse.json({ videos: videosWithCreators }, {
        headers: {
          'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
          'CDN-Cache-Control': 's-maxage=240'
        }
      });
    }

    // Original behavior when no creatorDid: category-based matching
    let query = supabase
      .from("videos")
      .select(VIDEO_SELECT)
      .eq("visibility", "public")
      .neq("id", videoId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filterContentType) {
      query = query.eq("content_type", filterContentType);
    }

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
        .select(VIDEO_SELECT)
        .eq("visibility", "public")
        .neq("id", videoId)
        .eq("content_type", filterContentType)
        .neq("category", currentVideo.category)
        .order("created_at", { ascending: false })
        .limit(remainingLimit);

      if (moreVideos) {
        videos.push(...moreVideos);
      }
    }

    const videosWithCreators = await attachCreators(videos || []);

    return NextResponse.json({ videos: videosWithCreators }, {
      headers: {
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        'CDN-Cache-Control': 's-maxage=240'
      }
    });
  } catch (error) {
    console.error("[RelatedVideos] Unexpected error:", error);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
