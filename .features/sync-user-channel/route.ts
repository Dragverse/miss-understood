import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyPrivyToken } from "@/lib/auth/verify";
import { XMLParser } from "fast-xml-parser";

/**
 * POST /api/youtube/sync-user-channel
 * Syncs a user's YouTube channel videos to their Dragverse profile
 *
 * Body:
 * - youtubeChannelId: The user's YouTube channel ID (from their Google account)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { userId } = await verifyPrivyToken(token);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { youtubeChannelId } = body;

    if (!youtubeChannelId) {
      return NextResponse.json(
        { success: false, error: "YouTube channel ID is required" },
        { status: 400 }
      );
    }

    console.log(`[YouTube Sync] Syncing channel ${youtubeChannelId} for user ${userId}`);

    // Fetch YouTube RSS feed
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`;
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DragverseBot/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`[YouTube Sync] RSS fetch failed: ${response.status}`);
      return NextResponse.json(
        { success: false, error: "Failed to fetch YouTube channel" },
        { status: 400 }
      );
    }

    const xmlText = await response.text();

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const result = parser.parse(xmlText);

    // Extract entries
    const entries = result?.feed?.entry;
    if (!entries) {
      return NextResponse.json({
        success: true,
        message: "No videos found in channel",
        count: 0,
      });
    }

    const videoEntries = Array.isArray(entries) ? entries : [entries];

    // Update creator's YouTube channel ID in database
    const supabase = getSupabaseServerClient();
    const { error: updateError } = await supabase
      .from('creators')
      .update({ youtube_channel_id: youtubeChannelId })
      .eq('did', userId);

    if (updateError) {
      console.error('[YouTube Sync] Failed to update creator:', updateError);
    }

    // Transform videos to Dragverse format
    const videos = videoEntries.slice(0, 20).map((entry: any) => {
      const videoId = entry["yt:videoId"];
      const title = entry["media:group"]["media:title"] || entry.title;
      const description = entry["media:group"]["media:description"] || "";
      const thumbnail = entry["media:group"]["media:thumbnail"]?.["@_url"] || "";
      const publishedAt = new Date(entry.published);

      return {
        external_id: `youtube-${videoId}`,
        title,
        description,
        thumbnail,
        playback_url: `https://www.youtube.com/watch?v=${videoId}`,
        external_url: `https://www.youtube.com/watch?v=${videoId}`,
        youtube_id: videoId,
        source: "youtube",
        creator_did: userId,
        created_at: publishedAt.toISOString(),
        views: 0,
        likes: 0,
        duration: 0,
        content_type: "long", // Default, could be detected as "short" based on video metadata
      };
    });

    return NextResponse.json({
      success: true,
      message: `Found ${videos.length} videos from YouTube channel`,
      count: videos.length,
      videos: videos.slice(0, 5), // Return first 5 for preview
      channelId: youtubeChannelId,
    });
  } catch (error) {
    console.error("[YouTube Sync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync YouTube channel",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
