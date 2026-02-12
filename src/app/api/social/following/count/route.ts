import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userDID = auth.userId;

    // Count follows where user is the follower (Dragverse only)
    const supabase = getSupabaseServerClient();
    const { count, error } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_did", userDID)
      .eq("source", "dragverse");

    if (error) {
      console.error("Error counting following:", error);
      return NextResponse.json({
        success: false,
        error: "Failed to count following",
      });
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
    });
  } catch (error) {
    console.error("Error fetching following count:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch following count",
      },
      { status: 500 }
    );
  }
}
