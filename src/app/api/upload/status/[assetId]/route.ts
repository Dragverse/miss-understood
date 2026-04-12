import { NextRequest, NextResponse } from "next/server";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Livepeer API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${LIVEPEER_API_URL}/asset/${assetId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get asset status" },
        { status: response.status }
      );
    }

    const asset = await response.json();

    const playbackId = asset.playbackId || '';

    // Always construct from playbackId using the known-good vod-cdn gateway.
    // Livepeer may return a dead gateway URL (e.g. nyc-prod-catalyst-0) in asset.playbackUrl —
    // ignore it and use the correct CDN pattern whenever we have a playbackId.
    let playbackUrl = '';
    if (playbackId) {
      playbackUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${playbackId}/index.m3u8`;
    } else {
      // No playbackId — fall back to whatever Livepeer returned, appending .m3u8 if needed
      playbackUrl = asset.playbackUrl || '';
      if (playbackUrl && !playbackUrl.endsWith('.m3u8')) {
        playbackUrl = `${playbackUrl}/index.m3u8`;
      }
    }

    return NextResponse.json({
      id: asset.id,
      name: asset.name,
      status: asset.status,
      playbackUrl,
      playbackId,
      downloadUrl: asset.downloadUrl || null,
    });
  } catch (error) {
    console.error("Asset status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
