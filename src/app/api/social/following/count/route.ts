import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy/verify-token";
import { getSupabaseServerClient } from "@/lib/supabase/client";

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
