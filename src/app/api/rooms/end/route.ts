import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { roomId } = await request.json();
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Only the creator can end the room
    const { error } = await supabase
      .from("rooms")
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq("huddle_room_id", roomId)
      .eq("creator_did", auth.userId);

    if (error) {
      console.error("[Rooms] End error:", error);
      return NextResponse.json({ error: "Failed to end room" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Rooms] End error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
