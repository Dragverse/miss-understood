import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * GET /api/posts/feed
 * Get posts feed (public posts, newest first)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const creatorDid = searchParams.get("creatorDid"); // Optional filter by creator

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("posts")
      .select(`
        *,
        creator:creators!posts_creator_id_fkey(
          did,
          handle,
          display_name,
          avatar,
          verified,
          bluesky_handle,
          farcaster_handle
        )
      `)
      .eq("visibility", "public")
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by creator if specified
    if (creatorDid) {
      query = query.eq("creator_did", creatorDid);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error("Failed to fetch posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    // Enrich posts that were crossposted to Bluesky with live like/reply counts.
    // app.bsky.feed.getPosts accepts up to 25 URIs per call.
    const bskyUriMap = new Map<string, { likeCount: number; replyCount: number; repostCount: number }>();
    const postsWithUri = (posts || []).filter((p: any) => p.bluesky_post_uri);

    if (postsWithUri.length > 0) {
      try {
        const agent = await getBlueskyAgent();
        const uris = postsWithUri.map((p: any) => p.bluesky_post_uri as string);

        // Batch in chunks of 25 (AT Protocol limit)
        for (let i = 0; i < uris.length; i += 25) {
          const chunk = uris.slice(i, i + 25);
          const res = await agent.app.bsky.feed.getPosts({ uris: chunk });
          for (const bskyPost of res.data.posts) {
            bskyUriMap.set(bskyPost.uri, {
              likeCount: (bskyPost as any).likeCount || 0,
              replyCount: (bskyPost as any).replyCount || 0,
              repostCount: (bskyPost as any).repostCount || 0,
            });
          }
        }
      } catch (err) {
        // Non-fatal — fall back to Dragverse-only counts
        console.warn("[Posts feed] Bluesky count enrichment failed:", err);
      }
    }

    // Transform posts to include social handles and merged Bluesky counts
    const transformedPosts = posts?.map(post => {
      const bsky = post.bluesky_post_uri ? bskyUriMap.get(post.bluesky_post_uri) : null;
      return {
        ...post,
        // Combine Dragverse + Bluesky counts so the post shows total engagement
        likes: (post.likes || 0) + (bsky?.likeCount || 0),
        comment_count: (post.comment_count || 0) + (bsky?.replyCount || 0),
        repost_count: (post.repost_count || 0) + (bsky?.repostCount || 0),
        bluesky_likes: bsky?.likeCount || 0,
        source: "dragverse",
        creator: post.creator ? {
          ...post.creator,
          blueskyHandle: (post.creator as any).bluesky_handle,
          farcasterHandle: (post.creator as any).farcaster_handle,
        } : undefined,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      posts: transformedPosts,
      count: transformedPosts.length,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 's-maxage=120'
      }
    });
  } catch (error) {
    console.error("Posts feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
