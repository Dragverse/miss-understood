import { NextResponse } from "next/server";

const LIVEPEER_API_URL = "https://livepeer.studio/api";
// Use environment variable or fallback to extracting from HLS URL
const OFFICIAL_STREAM_ID = process.env.OFFICIAL_STREAM_ID || "fb7f1684-1b1a-4779-a4fd-2397bc714b96";
const OFFICIAL_PLAYBACK_ID = process.env.OFFICIAL_PLAYBACK_ID || "fb7fdq50qnczbi4u";
const STREAM_URL = `https://livepeercdn.studio/hls/${OFFICIAL_PLAYBACK_ID}/index.m3u8`;

export async function GET() {
  try {
    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      console.error("LIVEPEER_API_KEY not found in environment variables");
      // Even without API key, try fallback HLS check
      return fallbackHLSCheck();
    }

    // Call Livepeer API to check stream status
    const response = await fetch(
      `${LIVEPEER_API_URL}/stream/${OFFICIAL_STREAM_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store" // Prevent caching for real-time status
      }
    );

    if (!response.ok) {
      // If stream not found or API error, fallback to HLS check
      console.warn(`Livepeer API returned ${response.status}, falling back to HLS check`);
      return fallbackHLSCheck();
    }

    const streamData = await response.json();

    return NextResponse.json({
      isLive: streamData.isActive || false,
      streamId: OFFICIAL_STREAM_ID,
      playbackId: streamData.playbackId || OFFICIAL_PLAYBACK_ID,
      playbackUrl: `https://livepeercdn.studio/hls/${streamData.playbackId || OFFICIAL_PLAYBACK_ID}/index.m3u8`,
      viewerCount: streamData.viewerCount || 0,
      startedAt: streamData.lastSeen || null,
      method: "Livepeer API",
      fallback: false,
    });
  } catch (error) {
    console.error("Error checking stream status:", error);
    // Fallback to HLS manifest check if API fails
    return fallbackHLSCheck();
  }
}

// Fallback method: Check HLS manifest availability and content
async function fallbackHLSCheck() {
  try {
    const HLS_URL = `https://livepeercdn.studio/hls/${OFFICIAL_PLAYBACK_ID}/index.m3u8`;

    // Fetch the actual manifest content (not just HEAD)
    const response = await fetch(HLS_URL, {
      method: "GET",
      cache: "no-store", // Prevent caching to get real-time status
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        isLive: false,
        fallback: true,
        streamId: OFFICIAL_STREAM_ID,
        playbackId: OFFICIAL_PLAYBACK_ID,
        playbackUrl: STREAM_URL,
        method: "HLS manifest check",
        reason: "Manifest not found"
      });
    }

    // Read the manifest content
    const manifestText = await response.text();

    // Check for various indicators of a live stream
    const hasMediaSegments = manifestText.includes('.ts') ||
                            manifestText.includes('.m4s');

    const hasExtInf = manifestText.includes('#EXTINF');
    const hasSequence = manifestText.includes('#EXT-X-MEDIA-SEQUENCE');
    const hasTargetDuration = manifestText.includes('#EXT-X-TARGETDURATION');

    // A live stream should have:
    // 1. Media segments OR
    // 2. Playlist tags (EXTINF, sequence, target duration)
    // 3. Non-trivial content (>50 characters)
    const hasPlaylistIndicators = hasExtInf || hasSequence || hasTargetDuration;
    const hasContent = manifestText.length > 50;

    const isLive = (hasMediaSegments || hasPlaylistIndicators) && hasContent;

    console.log(`Stream check: segments=${hasMediaSegments}, playlist=${hasPlaylistIndicators}, size=${manifestText.length}, isLive=${isLive}`);

    return NextResponse.json({
      isLive,
      fallback: true,
      streamId: OFFICIAL_STREAM_ID,
      playbackId: OFFICIAL_PLAYBACK_ID,
      playbackUrl: STREAM_URL,
      method: "HLS manifest content check",
      reason: isLive ? "Active stream detected" : "No active stream"
    });
  } catch (error) {
    console.error("Fallback HLS check error:", error);
    return NextResponse.json({
      isLive: false,
      fallback: true,
      streamId: OFFICIAL_STREAM_ID,
      playbackId: OFFICIAL_PLAYBACK_ID,
      playbackUrl: STREAM_URL,
      error: "Failed to check stream status",
    });
  }
}
