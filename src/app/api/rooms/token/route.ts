import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { AccessToken, Role } from "@huddle01/server-sdk/auth";
import { API } from "@huddle01/server-sdk/api";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const displayName = searchParams.get("displayName") || "Drag Artist";
    const avatarUrl = searchParams.get("avatarUrl") || "/defaultpfp.png";

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const apiKey = process.env.HUDDLE01_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Huddle01 not configured" }, { status: 500 });
    }

    // Check how many peers are in the room — first joiner becomes host
    let isHost = false;
    try {
      const api = new API({ apiKey });
      const livePeers = await api.getLivePartipantsDetails({ roomId });
      isHost = livePeers.length === 0;
    } catch {
      isHost = false;
    }

    const accessToken = new AccessToken({
      apiKey,
      roomId,
      role: isHost ? Role.HOST : Role.LISTENER,
      permissions: {
        admin: isHost,
        canConsume: true,
        canProduce: isHost,
        canProduceSources: { cam: isHost, mic: true, screen: false },
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
