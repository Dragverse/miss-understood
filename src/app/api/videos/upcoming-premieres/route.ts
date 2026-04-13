import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/videos/upcoming-premieres
 * Returns public videos that have premiere_mode='countdown' and published_at in the future.
 * Used by UpcomingPremieresSection on the homepage and snapshots page.
 *
 * Query params:
 *   contentType  – optional filter ("short", "long", "podcast", "music")
 *   limit        – default 10
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
    const contentType = searchParams.get("contentType");

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    let query = supabase
      .from("videos")
      .select("id, title, thumbnail, published_at, content_type, premiere_mode, creator_id, playback_id")
      .eq("visibility", "public")
      .eq("premiere_mode", "countdown")
      .gt("published_at", now)
      .order("published_at", { ascending: true })
      .limit(limit);

    if (contentType) {
      query = query.eq("content_type", contentType);
    }

    const { data: videos, error } = await query;

    if (error) {
      console.error("[upcoming-premieres] Query error:", error);
      return NextResponse.json({ success: false, premieres: [] }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ success: true, premieres: [] });
    }

    // Batch-fetch creators
    const uniqueCreatorIds = [...new Set(videos.map((v) => v.creator_id).filter(Boolean))];
    const creatorsMap = new Map<string, { handle: string; display_name: string; avatar: string | null }>();

    if (uniqueCreatorIds.length > 0) {
      const { data: creatorsData } = await supabase
        .from("creators")
        .select("id, handle, display_name, avatar")
        .in("id", uniqueCreatorIds);

      if (creatorsData) {
        creatorsData.forEach((c) => creatorsMap.set(c.id, c));
      }
    }

    const premieres = videos.map((v) => {
      const creator = v.creator_id ? creatorsMap.get(v.creator_id) : null;
      return {
        id: v.id,
        title: v.title,
        thumbnail: v.thumbnail || null,
        publishedAt: v.published_at,
        contentType: v.content_type,
        premiereMode: v.premiere_mode,
        creatorHandle: creator?.handle ?? null,
        creatorName: creator?.display_name ?? "Creator",
        creatorAvatar: creator?.avatar ?? null,
      };
    });

    return NextResponse.json(
      { success: true, premieres },
      {
        headers: {
          // Short cache: premieres transition to live over time
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[upcoming-premieres] Error:", err);
    return NextResponse.json({ success: false, premieres: [] }, { status: 500 });
  }
}
