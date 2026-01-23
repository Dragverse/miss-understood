import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const followerDID = searchParams.get("followerDID");
  const followingDID = searchParams.get("followingDID");

  if (!followerDID || !followingDID) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_did", followerDID)
      .eq("following_did", followingDID)
      .single();

    // If no data found, user is not following
    return NextResponse.json({ following: !!data });
  } catch (error) {
    // Any error (including no rows) means not following
    return NextResponse.json({ following: false });
  }
}
