import { NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * GET /api/youtube/test
 * Test YouTube API connection and quota
 */
export async function GET() {
  try {
    // Test 1: Check if API key is set
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "YouTube API key not configured",
        apiKeySet: false,
        tests: {
          apiKeyConfigured: false,
        },
      });
    }

    const apiKeyPreview = `${YOUTUBE_API_KEY.substring(0, 10)}...${YOUTUBE_API_KEY.substring(YOUTUBE_API_KEY.length - 4)}`;

    // Test 2: Simple search query
    const testQuery = "drag queen";
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set("part", "id,snippet");
    searchUrl.searchParams.set("q", testQuery);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "1");
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    console.log("[YouTube Test] Testing search API with query:", testQuery);
    const response = await fetch(searchUrl.toString());

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "YouTube API returned error",
        apiKeySet: true,
        apiKeyPreview,
        tests: {
          apiKeyConfigured: true,
          searchTest: {
            status: response.status,
            statusText: response.statusText,
            error: responseData.error || responseData,
          },
        },
      });
    }

    // Test 3: Check quota and results
    const hasResults = responseData.items && responseData.items.length > 0;
    const pageInfo = responseData.pageInfo || {};

    return NextResponse.json({
      success: true,
      apiKeySet: true,
      apiKeyPreview,
      tests: {
        apiKeyConfigured: true,
        searchTest: {
          passed: true,
          query: testQuery,
          resultsFound: hasResults,
          totalResults: pageInfo.totalResults || 0,
          resultsPerPage: pageInfo.resultsPerPage || 0,
          sampleVideo: hasResults ? {
            id: responseData.items[0].id.videoId,
            title: responseData.items[0].snippet.title,
            channel: responseData.items[0].snippet.channelTitle,
          } : null,
        },
        quotaInfo: {
          message: "Each search costs ~100 quota units",
          dailyLimit: "10,000 units per day",
          estimatedSearchesPerDay: "~100 searches",
        },
      },
      recommendation: hasResults
        ? "✅ YouTube API is working! If /api/youtube/feed returns 0, check server logs for errors."
        : "⚠️ API works but returned 0 results. This could be: 1) Quota exceeded, 2) No matching videos, 3) API restrictions",
    });
  } catch (error) {
    console.error("[YouTube Test] Exception:", error);
    return NextResponse.json({
      success: false,
      error: "Exception during test",
      details: error instanceof Error ? error.message : String(error),
      apiKeySet: !!YOUTUBE_API_KEY,
    });
  }
}
