import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select(`
        id,
        huddle_room_id,
        title,
        tags,
        privacy,
        creator_did,
        is_live,
        listener_count,
        created_at,
        profiles:creators!creator_did (
          handle,
          display_name,
          avatar
        )
      `)
      .eq("is_live", true)
      .eq("privacy", "public")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[Rooms] List error:", error);
      return NextResponse.json({ rooms: [] });
    }

    return NextResponse.json({ success: true, rooms: rooms ?? [] });
  } catch (err) {
    console.error("[Rooms] List error:", err);
    return NextResponse.json({ rooms: [] });
  }
}
