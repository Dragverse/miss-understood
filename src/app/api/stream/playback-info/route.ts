import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/stream/playback-info?playbackId={id}
 * Proxies Livepeer's playback info API so the client can get WebRTC WHEP sources.
 * Cached for 5s — short enough to react to stream going live/offline.
 */
export async function GET(request: NextRequest) {
  const playbackId = request.nextUrl.searchParams.get("playbackId");

  if (!playbackId) {
    return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
  }

  const apiKey = process.env.LIVEPEER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Livepeer API key not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://livepeer.studio/api/playback/${playbackId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 5 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Playback info not found" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
    });
  } catch (error) {
    console.error("Playback info fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
