import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { API } from "@huddle01/server-sdk/api";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { title, tags = [], privacy = "public" } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Room title is required" }, { status: 400 });
    }

    const apiKey = process.env.HUDDLE01_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Huddle01 not configured" }, { status: 500 });
    }

    // Create room via Huddle01 SDK (v2)
    const api = new API({ apiKey });
    const { roomId: huddleRoomId } = await api.createRoom({
      roomLocked: privacy === "private",
      metadata: JSON.stringify({ title: title.trim() }),
    });

    // Persist to Supabase
    const supabase = getSupabaseServerClient();
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        huddle_room_id: huddleRoomId,
        title: title.trim(),
        tags,
        privacy,
        creator_did: auth.userId,
        is_live: true,
        listener_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("[Rooms] Supabase insert failed:", error);
      // Room was created in Huddle01 — return the ID even if DB save fails
      return NextResponse.json({ success: true, roomId: huddleRoomId, title: title.trim() });
    }

    return NextResponse.json({ success: true, roomId: huddleRoomId, room });
  } catch (err) {
    console.error("[Rooms] Create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
