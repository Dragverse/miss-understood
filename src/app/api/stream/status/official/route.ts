import { NextResponse } from "next/server";

const LIVEPEER_API_URL = "https://livepeer.studio/api";
// Use environment variable or fallback to extracting from HLS URL
const OFFICIAL_STREAM_ID = process.env.OFFICIAL_STREAM_ID || "fb7fdq50-qncz-bi4u-0000-000000000000";
const OFFICIAL_PLAYBACK_ID = process.env.OFFICIAL_PLAYBACK_ID || "fb7fdq50qnczbi4u";

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
      viewerCount: streamData.viewerCount || 0,
      startedAt: streamData.lastSeen || null,
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
      cache: "no-store" // Prevent caching to get real-time status
    });

    if (!response.ok) {
      return NextResponse.json({
        isLive: false,
        fallback: true,
        method: "HLS manifest check",
        reason: "Manifest not found"
      });
    }

    const contentType = response.headers.get("content-type");
    const isM3U8 = contentType?.includes("application/vnd.apple.mpegurl") ||
                   contentType?.includes("application/x-mpegURL");

    if (!isM3U8) {
      return NextResponse.json({
        isLive: false,
        fallback: true,
        method: "HLS manifest check",
        reason: "Invalid content type"
      });
    }

    // Read the manifest content
    const manifestText = await response.text();

    // Check if manifest has actual media segments
    // A live stream will have .ts segment files listed
    // An offline stream will either have no segments or be empty/minimal
    const hasMediaSegments = manifestText.includes('.ts') ||
                            manifestText.includes('.m4s') ||
                            manifestText.includes('#EXTINF');

    const isLive = hasMediaSegments && manifestText.length > 100; // Reasonable size check

    return NextResponse.json({
      isLive,
      fallback: true,
      method: "HLS manifest content check",
      reason: isLive ? "Active segments found" : "No active segments"
    });
  } catch (error) {
    console.error("Fallback HLS check error:", error);
    return NextResponse.json({
      isLive: false,
      fallback: true,
      error: "Failed to check stream status",
    });
  }
}
