import { NextRequest, NextResponse } from "next/server";
import { getVideos } from "@/lib/supabase/videos";
import { searchDragContent as searchYouTubeDragContent } from "@/lib/youtube/client";

/**
 * GET /api/debug/content
 * Diagnostic endpoint to check all content sources
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    sources: {},
  };

  // Check Supabase
  try {
    console.log("[Debug] Testing Supabase connection...");
    const supabaseVideos = await getVideos(10);
    diagnostics.sources.supabase = {
      success: true,
      count: supabaseVideos.length,
      sample: supabaseVideos.slice(0, 2).map((v) => ({
        id: v.id,
        title: v.title,
        creator_did: v.creator_did,
      })),
    };
  } catch (error) {
    diagnostics.sources.supabase = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check Bluesky API
  try {
    console.log("[Debug] Testing Bluesky API...");
    const blueskyResponse = await fetch(`${request.nextUrl.origin}/api/bluesky/feed?limit=5`);
    const blueskyData = await blueskyResponse.json();
    const content = blueskyData.videos || blueskyData.posts || [];
    diagnostics.sources.bluesky = {
      success: blueskyData.success || false,
      count: content.length,
      sample: content.slice(0, 2).map((v: any) => ({
        id: v.id,
        title: v.title || v.description?.substring(0, 50),
        source: v.source,
      })),
      error: blueskyData.error || null,
      rawResponse: {
        hasVideos: !!blueskyData.videos,
        hasPosts: !!blueskyData.posts,
        success: blueskyData.success,
      },
    };
  } catch (error) {
    diagnostics.sources.bluesky = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check YouTube API (server-side)
  try {
    console.log("[Debug] Testing YouTube API (server-side)...");
    const youtubeVideos = await searchYouTubeDragContent(5);
    diagnostics.sources.youtube_server = {
      success: true,
      count: youtubeVideos.length,
      sample: youtubeVideos.slice(0, 2).map((v) => ({
        id: v.id,
        title: v.title,
        source: v.source,
      })),
      apiKey: process.env.YOUTUBE_API_KEY ? "Set (hidden)" : "NOT SET",
    };
  } catch (error) {
    diagnostics.sources.youtube_server = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      apiKey: process.env.YOUTUBE_API_KEY ? "Set (hidden)" : "NOT SET",
    };
  }

  // Check YouTube API endpoint
  try {
    console.log("[Debug] Testing YouTube API endpoint...");
    const youtubeResponse = await fetch(`${request.nextUrl.origin}/api/youtube/feed?limit=5`);
    const youtubeData = await youtubeResponse.json();
    diagnostics.sources.youtube_endpoint = {
      success: youtubeData.success || false,
      count: youtubeData.videos?.length || 0,
      sample: (youtubeData.videos || []).slice(0, 2).map((v: any) => ({
        id: v.id,
        title: v.title,
        source: v.source,
      })),
      warning: youtubeData.warning || null,
      error: youtubeData.error || null,
    };
  } catch (error) {
    diagnostics.sources.youtube_endpoint = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Environment checks
  diagnostics.environment = {
    hasYouTubeKey: !!process.env.YOUTUBE_API_KEY,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasBlueskyIdentifier: !!process.env.BLUESKY_IDENTIFIER,
    hasBlueskyAppPassword: !!process.env.BLUESKY_APP_PASSWORD,
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
