import { NextResponse } from "next/server";
import { getVideos } from "@/lib/supabase/videos";
import { transformVideosWithCreators } from "@/lib/supabase/transform-video";

/**
 * GET /api/videos/shorts
 * Fetch ONLY Dragverse short videos (no YouTube, no external sources)
 */
export async function GET() {
  try {
    console.log('[Dragverse Shorts API] Fetching shorts from database...');

    // Fetch videos from Supabase
    const supabaseVideos = await getVideos(100);

    // Transform with creator data (includes URL fixing)
    const allVideos = await transformVideosWithCreators(supabaseVideos);

    // Filter for shorts only
    const shorts = allVideos.filter(v => v.contentType === "short");

    // Sort by date (newest first)
    shorts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`[Dragverse Shorts API] Returning ${shorts.length} Dragverse shorts`);

    return NextResponse.json({
      success: true,
      videos: shorts,
      count: shorts.length,
      source: "dragverse-database",
    });
  } catch (error) {
    console.error("[Dragverse Shorts API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Dragverse shorts",
        details: error instanceof Error ? error.message : String(error),
        videos: [],
      },
      { status: 500 }
    );
  }
}
