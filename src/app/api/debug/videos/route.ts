import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/debug/videos
 * Debug endpoint to check video storage and relationships
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    // Get all videos with creator info
    const { data: videos, error: videosError } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        content_type,
        creator_did,
        creator_id,
        playback_url,
        thumbnail,
        visibility,
        created_at,
        creator:creators!creator_id (
          id,
          did,
          handle,
          display_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (videosError) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch videos",
        details: videosError.message,
      });
    }

    // Get counts
    const { count: videoCount } = await supabase
      .from("videos")
      .select("*", { count: "exact", head: true });

    const { count: creatorCount } = await supabase
      .from("creators")
      .select("*", { count: "exact", head: true });

    // Check for orphaned videos (videos without creators)
    const { data: orphanedVideos, error: orphanError } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        creator_did,
        creator_id
      `)
      .is("creator_id", null);

    // Check for videos with mismatched creator relationships
    const videosWithIssues = videos?.filter(v => !v.creator) || [];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalVideos: videoCount || 0,
        totalCreators: creatorCount || 0,
        videosWithIssues: videosWithIssues.length,
        orphanedVideos: orphanedVideos?.length || 0,
      },
      videos: videos?.map(v => ({
        id: v.id,
        title: v.title,
        contentType: v.content_type,
        creatorDID: v.creator_did,
        creatorId: v.creator_id,
        hasCreatorInfo: !!v.creator,
        creatorHandle: v.creator?.handle || "MISSING",
        playbackUrl: v.playback_url ? "✅" : "❌",
        thumbnail: v.thumbnail ? "✅" : "❌",
        visibility: v.visibility,
        createdAt: v.created_at,
      })),
      issues: {
        videosWithMissingCreator: videosWithIssues.map(v => ({
          videoId: v.id,
          title: v.title,
          creatorDID: v.creator_did,
          creatorId: v.creator_id,
        })),
        orphanedVideos: orphanedVideos || [],
      },
    });
  } catch (error) {
    console.error("Error debugging videos:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
