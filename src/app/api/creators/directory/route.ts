import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const verified = searchParams.get("verified"); // "true" or null
    const sortBy = searchParams.get("sortBy") || "followers"; // followers, views, recent, videos
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
        bluesky_handle
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
          },
          social: {
            twitter: creator.twitter_handle,
            instagram: creator.instagram_handle,
            tiktok: creator.tiktok_handle,
            bluesky: creator.bluesky_handle,
          },
          joinedAt: creator.created_at,
        };
      })
    );

    // Sort creators based on sortBy parameter
    creatorsWithStats.sort((a, b) => {
      switch (sortBy) {
        case "followers":
          return b.stats.followers - a.stats.followers;
        case "views":
          return b.stats.totalViews - a.stats.totalViews;
        case "videos":
          return b.stats.videos - a.stats.videos;
        case "recent":
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        default:
          return b.stats.followers - a.stats.followers;
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
