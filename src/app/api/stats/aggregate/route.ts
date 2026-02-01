import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";
import { aggregateFollowerStats } from "@/lib/utils/aggregate-followers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stats/aggregate
 * Fetch aggregated follower stats from YouTube, Bluesky, and Dragverse
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log(`[Aggregate API] Fetching stats for user ${userId}...`);

    // Fetch creator record from Supabase
    // Note: youtube_channel_id and youtube_follower_count columns not yet migrated
    const { data: creator, error } = await supabase
      .from("creators")
      .select(
        `
        id,
        did,
        handle,
        display_name,
        dragverse_follower_count,
        following_count,
        bluesky_handle,
        bluesky_follower_count,
        farcaster_fid,
        farcaster_follower_count
      `
      )
      .eq("did", userId)
      .single();

    if (error || !creator) {
      console.warn(`[Aggregate API] Creator not found for user ${userId}:`, error);

      // Return zero stats if creator doesn't exist yet
      return NextResponse.json({
        success: true,
        stats: {
          totalFollowers: 0,
          totalFollowing: 0,
          dragverseFollowers: 0,
          dragverseFollowing: 0,
          blueskyFollowers: 0,
          blueskyFollowing: 0,
          farcasterFollowers: 0,
          farcasterFollowing: 0,
          youtubeSubscribers: 0,
          lastUpdated: new Date(),
          platforms: {
            dragverse: false,
            bluesky: false,
            farcaster: false,
            youtube: false,
          },
        },
      });
    }

    // Aggregate stats from all platforms
    // Note: YouTube integration not yet migrated, passing undefined
    const stats = await aggregateFollowerStats({
      dragverseFollowerCount: creator.dragverse_follower_count || 0,
      dragverseFollowingCount: creator.following_count || 0,
      blueskyHandle: creator.bluesky_handle,
      blueskyFollowerCount: creator.bluesky_follower_count,
      farcasterFid: creator.farcaster_fid,
      farcasterFollowerCount: creator.farcaster_follower_count,
      youtubeChannelId: undefined,
      youtubeFollowerCount: undefined,
    });

    // Update cached counts in database (async, don't wait)
    void (async () => {
      try {
        const { error } = await supabase
          .from("creators")
          .update({
            bluesky_follower_count: stats.blueskyFollowers,
            farcaster_follower_count: stats.farcasterFollowers,
            youtube_follower_count: stats.youtubeSubscribers,
            follower_count: stats.totalFollowers, // Update total in main column
            updated_at: new Date().toISOString(),
          })
          .eq("id", creator.id);

        if (error) {
          console.error(`[Aggregate API] Failed to update cached stats:`, error);
        } else {
          console.log(`[Aggregate API] Updated cached stats for creator ${creator.id}`);
        }
      } catch (err) {
        console.error(`[Aggregate API] Exception updating cached stats:`, err);
      }
    })();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[Aggregate API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to aggregate follower stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
