import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy/verify-token";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { getFollowing } from "@/lib/supabase/social";

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const verifiedClaims = await verifyPrivyToken(token);

    if (!verifiedClaims || !verifiedClaims.userId) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const userDID = verifiedClaims.userId;

    // Get list of DIDs the user follows
    const followingList = await getFollowing(userDID, 1000); // Get all following
    if (!followingList || followingList.length === 0) {
      return NextResponse.json({
        success: true,
        creators: [],
      });
    }

    const followingDIDs = followingList.map((f: any) => f.following_did);

    // Get full creator profiles for each DID
    const supabase = getSupabaseServerClient();
    const { data: creatorsData, error: creatorsError } = await supabase
      .from("creators")
      .select("*")
      .in("did", followingDIDs);

    if (creatorsError) {
      console.error("Error fetching creators:", creatorsError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch creators",
        },
        { status: 500 }
      );
    }

    // Optimize: Run all stats queries in parallel to reduce latency
    const [videoCounts, followerCounts, followingCounts, videoStats] = await Promise.all([
      // Video counts
      supabase
        .from("videos")
        .select("creator_did")
        .in("creator_did", followingDIDs),
      // Follower counts (Dragverse only)
      supabase
        .from("follows")
        .select("following_did")
        .in("following_did", followingDIDs)
        .eq("source", "dragverse"),
      // Following counts (Dragverse only)
      supabase
        .from("follows")
        .select("follower_did")
        .in("follower_did", followingDIDs)
        .eq("source", "dragverse"),
      // Video stats (views, likes)
      supabase
        .from("videos")
        .select("creator_did, views, likes")
        .in("creator_did", followingDIDs),
    ]);

    // Build maps from results
    const videoCountMap = new Map<string, number>();
    if (videoCounts.data) {
      videoCounts.data.forEach((v: any) => {
        const count = videoCountMap.get(v.creator_did) || 0;
        videoCountMap.set(v.creator_did, count + 1);
      });
    }

    const followerCountMap = new Map<string, number>();
    if (followerCounts.data) {
      followerCounts.data.forEach((f: any) => {
        const count = followerCountMap.get(f.following_did) || 0;
        followerCountMap.set(f.following_did, count + 1);
      });
    }

    const followingCountMap = new Map<string, number>();
    if (followingCounts.data) {
      followingCounts.data.forEach((f: any) => {
        const count = followingCountMap.get(f.follower_did) || 0;
        followingCountMap.set(f.follower_did, count + 1);
      });
    }

    const statsMap = new Map<string, { totalViews: number; totalLikes: number }>();
    if (videoStats.data) {
      videoStats.data.forEach((v: any) => {
        const existing = statsMap.get(v.creator_did) || { totalViews: 0, totalLikes: 0 };
        statsMap.set(v.creator_did, {
          totalViews: existing.totalViews + (v.views || 0),
          totalLikes: existing.totalLikes + (v.likes || 0),
        });
      });
    }

    // Transform creators to match expected format
    const creators = creatorsData.map((creator: any) => {
      const videoCount = videoCountMap.get(creator.did) || 0;
      const followerCount = followerCountMap.get(creator.did) || 0;
      const followingCount = followingCountMap.get(creator.did) || 0;
      const stats = statsMap.get(creator.did) || { totalViews: 0, totalLikes: 0 };

      // Calculate account age
      const createdAt = new Date(creator.created_at);
      const now = new Date();
      const daysSinceJoin = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const accountAgeMonths = Math.max(1, Math.floor(daysSinceJoin / 30));

      // Is creator "new"? (less than 30 days)
      const isNew = daysSinceJoin < 30;

      // Videos per month
      const videosPerMonth = videoCount / accountAgeMonths;

      return {
        id: creator.id,
        did: creator.did,
        handle: creator.handle,
        displayName: creator.display_name,
        avatar: creator.avatar || "/defaultpfp.png",
        banner: creator.banner,
        description: creator.description,
        verified: creator.verified || false,
        blueskyHandle: creator.bluesky_handle,
        farcasterHandle: creator.farcaster_handle,
        joinedAt: creator.created_at,
        stats: {
          followers: followerCount,
          dragverseFollowers: followerCount,
          following: followingCount,
          videos: videoCount,
          totalViews: stats.totalViews,
          totalLikes: stats.totalLikes,
          daysSinceJoin,
          isNew,
          videosPerMonth,
          accountAgeMonths,
        },
        social: {
          bluesky: creator.bluesky_handle,
          farcaster: creator.farcaster_handle,
        },
      };
    });

    return NextResponse.json({
      success: true,
      creators,
    });
  } catch (error) {
    console.error("Error fetching following list:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch following",
      },
      { status: 500 }
    );
  }
}
