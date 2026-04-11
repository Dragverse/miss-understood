import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/cron/publish-scheduled
 * Vercel Cron job that runs every minute to publish scheduled content.
 * - Finds videos where published_at <= NOW() AND premiere_mode IS NOT NULL
 * - Sets premiere_mode = null (marks as "activated"/published)
 * - Same for posts with scheduled_at <= NOW() AND premiere_mode IS NOT NULL
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    // Publish scheduled videos
    const { data: videos, error: videosError } = await supabase
      .from("videos")
      .update({ premiere_mode: null })
      .lte("published_at", now)
      .not("premiere_mode", "is", null)
      .select("id, title, premiere_mode");

    if (videosError) {
      console.error("[Cron] Failed to publish videos:", videosError);
    }

    // Publish scheduled posts
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .update({ premiere_mode: null })
      .lte("scheduled_at", now)
      .not("premiere_mode", "is", null)
      .select("id, premiere_mode");

    if (postsError) {
      console.error("[Cron] Failed to publish posts:", postsError);
    }

    const publishedVideos = videos?.length || 0;
    const publishedPosts = posts?.length || 0;

    if (publishedVideos > 0 || publishedPosts > 0) {
      console.log(`[Cron] Published ${publishedVideos} videos, ${publishedPosts} posts`);
    }

    return NextResponse.json({
      success: true,
      published: {
        videos: publishedVideos,
        posts: publishedPosts,
      },
    });
  } catch (error) {
    console.error("[Cron] Publish scheduled error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
