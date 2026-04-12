import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { AccessToken, Role } from "@huddle01/server-sdk/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    // Validate roomId — Huddle01 room IDs are alphanumeric + dashes
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }

    // Sanitize display name: strip HTML-like chars, limit length
    const rawName = searchParams.get("displayName") || "Drag Artist";
    const displayName = rawName.replace(/[<>"'&]/g, "").trim().slice(0, 50) || "Drag Artist";

    // Validate avatarUrl: only allow http/https or root-relative paths
    const rawAvatar = searchParams.get("avatarUrl") || "";
    let avatarUrl = "/defaultpfp.png";
    if (rawAvatar) {
      try {
        const parsed = new URL(rawAvatar);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          avatarUrl = rawAvatar;
        }
      } catch {
        // Root-relative paths (e.g. "/defaultpfp.png") are also fine
        if (/^\/[a-zA-Z0-9/_.-]+$/.test(rawAvatar)) {
          avatarUrl = rawAvatar;
        }
      }
    }

    const apiKey = process.env.HUDDLE01_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Huddle01 not configured" }, { status: 500 });
    }

    // Host = the user who created the room (DB source of truth, not participant count)
    const supabase = getSupabaseServerClient();
    const { data: room } = await supabase
      .from("rooms")
      .select("creator_did")
      .eq("huddle_room_id", roomId)
      .single();
    const isHost = room?.creator_did === auth.userId;

    const accessToken = new AccessToken({
      apiKey,
      roomId,
      // Non-hosts start as LISTENER — host promotes them to SPEAKER via updateRole
      role: isHost ? Role.HOST : Role.LISTENER,
      permissions: {
        admin: isHost,
        canConsume: true,
        canProduce: isHost,
        canProduceSources: { cam: isHost, mic: isHost, screen: false },
        canRecvData: true,
        canSendData: true,
        canUpdateMetadata: true,
      },
      options: {
        metadata: {
          displayName,
          avatarUrl,
          userId: auth.userId,
        },
      },
    });

    const token = await accessToken.toJwt();
    return NextResponse.json({ success: true, token, isHost });
  } catch (err) {
    console.error("[Rooms] Token error:", err);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
