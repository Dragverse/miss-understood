import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userDID = searchParams.get("userDID");
  const videoId = searchParams.get("videoId");

  if (!userDID || !videoId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("likes")
      .select("id")
      .eq("user_did", userDID)
      .eq("video_id", videoId)
      .single();

    // If no data found, user hasn't liked the video
    return NextResponse.json({ liked: !!data });
  } catch (error) {
    // Any error (including no rows) means not liked
    return NextResponse.json({ liked: false });
  }
}
