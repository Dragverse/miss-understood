import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const verified = searchParams.get("verified"); // "true" or null
    const sortBy = (searchParams.get("sortBy") as
      "best" | "followers" | "engagement" | "consistency" | "views" | "videos" | "recent") || "best";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";

    const supabase = getSupabaseServerClient();

    // Build query for creators with video statistics
    let query = supabase
      .from("creators")
      .select(`
        did,
        handle,
        display_name,
        avatar,
        banner,
        description,
        verified,
        follower_count,
        following_count,
        bluesky_follower_count,
        created_at,
        twitter_handle,
        instagram_handle,
        tiktok_handle,
        bluesky_handle,
        farcaster_handle
      `);

    // Filter by verified status
    if (verified === "true") {
      query = query.eq("verified", true);
    }

    // Search by name or handle
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`);
    }

    // Execute query
    const { data: creators, error } = await query;

    if (error) {
      console.error("Failed to fetch creators:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch creators", creators: [] },
        { status: 500 }
      );
    }

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        success: true,
        creators: [],
        count: 0,
      });
    }

    // Fetch video statistics for each creator
    const creatorsWithStats = await Promise.all(
      creators.map(async (creator) => {
        // Get video count and total views for this creator
        const { data: videos, error: videoError } = await supabase
          .from("videos")
          .select("views, likes")
          .eq("creator_did", creator.did);

        const videoCount = videos?.length || 0;
        const totalViews = videos?.reduce((sum, v) => sum + (v.views || 0), 0) || 0;
        const totalLikes = videos?.reduce((sum, v) => sum + (v.likes || 0), 0) || 0;

        // Calculate days since joining
        const joinDate = new Date(creator.created_at);
        const daysSinceJoin = Math.floor(
          (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Combined follower count (Dragverse + Bluesky)
        const totalFollowers =
          (creator.follower_count || 0) + (creator.bluesky_follower_count || 0);

        // Calculate new metrics
        const accountAgeMonths = Math.floor(daysSinceJoin / 30);
        const videosPerMonth = videoCount / Math.max(daysSinceJoin / 30, 1);
        const engagementRate = totalViews > 0
          ? (totalLikes / totalViews) * 100
          : 0;
        const avgViewsPerVideo = videoCount > 0
          ? totalViews / videoCount
          : 0;

        return {
          did: creator.did,
          handle: creator.handle,
          displayName: creator.display_name,
          avatar: creator.avatar,
          banner: creator.banner,
          description: creator.description,
          verified: creator.verified,
          stats: {
            followers: totalFollowers,
            dragverseFollowers: creator.follower_count || 0,
            blueskyFollowers: creator.bluesky_follower_count || 0,
            following: creator.following_count || 0,
            videos: videoCount,
            totalViews,
            totalLikes,
            daysSinceJoin,
            isNew: daysSinceJoin <= 30, // Joined within last 30 days
            videosPerMonth,
            engagementRate,
            avgViewsPerVideo,
            accountAgeMonths,
            overallScore: undefined as number | undefined,
          },
          social: {
            twitter: creator.twitter_handle,
            instagram: creator.instagram_handle,
            tiktok: creator.tiktok_handle,
            bluesky: creator.bluesky_handle,
            farcaster: (creator as any).farcaster_handle,
          },
          blueskyHandle: creator.bluesky_handle,
          farcasterHandle: (creator as any).farcaster_handle,
          joinedAt: creator.created_at,
        };
      })
    );

    // Calculate "Best Overall" score for each creator
    function calculateCreatorScore(creator: any): number {
      const stats = creator.stats;

      // Weight factors (total = 100%)
      const weights = {
        consistency: 0.30,    // 30% - videos per month
        engagement: 0.25,     // 25% - engagement rate
        longevity: 0.20,      // 20% - account age bonus
        volume: 0.15,         // 15% - total videos
        reach: 0.10,          // 10% - avg views per video
      };

      // Normalize each metric to 0-100 scale
      const consistencyScore = Math.min((stats.videosPerMonth / 10) * 100, 100);
      const engagementScore = Math.min((stats.engagementRate / 5) * 100, 100);
      const longevityScore = Math.min((stats.accountAgeMonths / 12) * 100, 100);
      const volumeScore = Math.min((stats.videos / 50) * 100, 100);
      const reachScore = Math.min((stats.avgViewsPerVideo / 10000) * 100, 100);

      // Calculate weighted score
      const overallScore =
        (consistencyScore * weights.consistency) +
        (engagementScore * weights.engagement) +
        (longevityScore * weights.longevity) +
        (volumeScore * weights.volume) +
        (reachScore * weights.reach);

      return overallScore;
    }

    // Calculate scores if using "best" sort
    if (sortBy === "best") {
      creatorsWithStats.forEach(creator => {
        creator.stats.overallScore = calculateCreatorScore(creator);
      });
    }

    // Sort creators based on sortBy parameter
    creatorsWithStats.sort((a, b) => {
      switch (sortBy) {
        case "best":
          return (b.stats.overallScore || 0) - (a.stats.overallScore || 0);
        case "followers":
          return b.stats.followers - a.stats.followers;
        case "engagement":
          return (b.stats.engagementRate || 0) - (a.stats.engagementRate || 0);
        case "consistency":
          return (b.stats.videosPerMonth || 0) - (a.stats.videosPerMonth || 0);
        case "views":
          return b.stats.totalViews - a.stats.totalViews;
        case "videos":
          return b.stats.videos - a.stats.videos;
        case "recent":
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        default:
          return (b.stats.overallScore || 0) - (a.stats.overallScore || 0);
      }
    });

    // Apply limit
    const limitedCreators = creatorsWithStats.slice(0, limit);

    return NextResponse.json({
      success: true,
      creators: limitedCreators,
      count: limitedCreators.length,
      total: creatorsWithStats.length,
    });
  } catch (error) {
    console.error("Failed to fetch creators directory:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch creators directory", creators: [] },
      { status: 500 }
    );
  }
}
