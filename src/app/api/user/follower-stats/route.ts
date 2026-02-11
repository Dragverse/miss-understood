import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getFollowerBreakdown } from "@/lib/farcaster/followers";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/user/follower-stats
 * Get follower count breakdown by source (Dragverse, Bluesky, Farcaster)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's creator ID
    const supabase = getSupabaseServerClient();
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", auth.userId)
      .single();

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Get follower breakdown
    const breakdown = await getFollowerBreakdown(creator.id);

    return NextResponse.json({
      success: true,
      total: breakdown.total,
      bySource: breakdown.bySource,
    });
  } catch (error) {
    console.error("[Follower Stats] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get follower stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
