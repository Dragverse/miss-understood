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

    // Ensure we always have a playback URL - construct from playbackId if needed
    let playbackUrl = asset.playbackUrl || '';
    const playbackId = asset.playbackId || '';

    // If Livepeer didn't provide full URL, construct it from playbackId
    if (!playbackUrl && playbackId) {
      playbackUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${playbackId}/index.m3u8`;
      console.log(`[AssetStatus] Constructed playback URL from playbackId: ${playbackId}`);
    }

    // Ensure HLS URLs end with .m3u8 (skip download URLs)
    const isDownloadUrl = playbackUrl.includes('/asset/') || playbackUrl.includes('/raw/');
    if (playbackUrl && !isDownloadUrl && !playbackUrl.endsWith('.m3u8')) {
      playbackUrl = `${playbackUrl}/index.m3u8`;
    }

    return NextResponse.json({
      id: asset.id,
      name: asset.name,
      status: asset.status,
      playbackUrl,
      playbackId,
      // downloadUrl intentionally excluded for security
    });
  } catch (error) {
    console.error("Asset status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
