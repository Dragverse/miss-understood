import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/videos/list
 * Server-side endpoint to fetch videos with full URLs using service role key
 * This bypasses RLS issues with client-side anon key truncating playback_url
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const contentType = searchParams.get('contentType');

    console.log('[Videos API] Fetching videos with server-side client...');

    const supabase = getSupabaseServerClient();

    // Build query — hide scheduled/unpublished content from public feed
    let query = supabase
      .from('videos')
      .select('*')
      .eq('visibility', 'public')
      .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add content type filter if specified
    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data: videos, error } = await query;

    if (error) {
      console.error('[Videos API] Query error:', error);
      return NextResponse.json(
        { success: false, error: error.message, videos: [] },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      console.log('[Videos API] No videos found');
      return NextResponse.json({
        success: true,
        videos: [],
        count: 0,
      });
    }

    console.log(`[Videos API] Found ${videos.length} videos`);

    // Fetch creators in batch
    const uniqueCreatorIds = [...new Set(videos.map(v => v.creator_id).filter(Boolean))];
    const creatorsMap = new Map();

    if (uniqueCreatorIds.length > 0) {
      const { data: creatorsData } = await supabase
        .from('creators')
        .select('id, did, handle, display_name, avatar, verified')
        .in('id', uniqueCreatorIds);

      if (creatorsData) {
        creatorsData.forEach(creator => {
          creatorsMap.set(creator.id, creator);
        });
      }
    }

    // Map creators to videos and fix playback URLs
    const videosWithCreators = videos.map(video => {
      // Fix Livepeer playback URLs — always use vod-cdn when playbackId is available
      let playbackUrl = video.playback_url || '';
      const playbackId = video.playback_id || video.livepeer_asset_id || '';
      const contentType = video.content_type || 'long';

      // Supabase Storage audio URLs pass through unchanged
      const isSupabaseUrl = playbackUrl.includes('supabase.co/storage');

      if (!isSupabaseUrl) {
        if (playbackId) {
          // Always construct from playbackId — overrides any dead gateway URLs
          // (e.g. nyc-prod-catalyst-0.lp-playback.studio is dead)
          playbackUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${playbackId}/index.m3u8`;
        } else if (playbackUrl && !playbackUrl.endsWith('.m3u8')) {
          playbackUrl = `${playbackUrl}/index.m3u8`;
        }
      }

      // Log warning if content has no playback URL at all
      if (!playbackUrl) {
        console.warn(`[Videos API] Warning: Content ${video.id} (${video.title}) has no playback URL or ID`);
      }

      return {
        ...video,
        playback_url: playbackUrl, // Return fixed URL
        creator: video.creator_id ? creatorsMap.get(video.creator_id) || null : null
      };
    });

    console.log(`[Videos API] Returning ${videosWithCreators.length} videos with fixed URLs`);

    return NextResponse.json({
      success: true,
      videos: videosWithCreators,
      count: videosWithCreators.length,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 's-maxage=120'
      }
    });
  } catch (error) {
    console.error("[Videos API] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        videos: [],
      },
      { status: 500 }
    );
  }
}
