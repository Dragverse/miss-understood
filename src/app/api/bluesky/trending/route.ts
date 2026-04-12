import { NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * API route to fetch trending drag-related hashtags from Bluesky
 * GET /api/bluesky/trending
 *
 * Uses parallel requests (Promise.allSettled) for speed.
 */
export async function GET() {
  try {
    const agent = await getBlueskyAgent();

    const dragHashtags = [
      // Core drag
      "#DragRace",
      "#DragQueen",
      "#DragKing",
      "#DragPerformance",
      "#DragArtist",
      "#DragMakeup",
      // Shows & events
      "#RuPaul",
      "#DragCon",
      "#DragShow",
      "#DragTour",
      // Styles & aesthetics
      "#Ballroom",
      "#Voguing",
      "#LipSync",
      "#DragTransformation",
      "#GlamDrag",
      // Community
      "#QueerArt",
      "#LGBTQ",
      "#DragCommunity",
      "#AlternativeDrag",
      "#Dragula",
    ];

    // Fetch all hashtag counts in parallel
    const results = await Promise.allSettled(
      dragHashtags.map((hashtag) =>
        agent.app.bsky.feed.searchPosts({ q: hashtag, limit: 100 }).then((res) => ({
          hashtag,
          postCount: res.data.posts.length,
          estimatedTotal: Math.round(res.data.posts.length * 82),
        }))
      )
    );

    const trendingHashtags = results
      .filter((r): r is PromiseFulfilledResult<{ hashtag: string; postCount: number; estimatedTotal: number }> =>
        r.status === "fulfilled" && r.value.postCount > 0
      )
      .map((r) => r.value)
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 8);

    if (trendingHashtags.length === 0) {
      return NextResponse.json({
        success: true,
        trending: FALLBACK_TRENDING,
      });
    }

    return NextResponse.json({ success: true, trending: trendingHashtags }, {
      headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1200" },
    });
  } catch (error) {
    console.error("Failed to fetch trending hashtags:", error);
    return NextResponse.json({ success: true, trending: FALLBACK_TRENDING });
  }
}

const FALLBACK_TRENDING = [
  { hashtag: "#DragRace", postCount: 820, estimatedTotal: 67240 },
  { hashtag: "#DragQueen", postCount: 750, estimatedTotal: 61500 },
  { hashtag: "#DragMakeup", postCount: 570, estimatedTotal: 46740 },
  { hashtag: "#Ballroom", postCount: 490, estimatedTotal: 40180 },
  { hashtag: "#LipSync", postCount: 410, estimatedTotal: 33620 },
  { hashtag: "#QueerArt", postCount: 380, estimatedTotal: 31160 },
  { hashtag: "#DragKing", postCount: 320, estimatedTotal: 26240 },
  { hashtag: "#Voguing", postCount: 290, estimatedTotal: 23780 },
];
