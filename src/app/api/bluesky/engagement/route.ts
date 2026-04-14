import { NextRequest, NextResponse } from "next/server";
import { getBlueskyAgent } from "@/lib/bluesky/client";

/**
 * GET /api/bluesky/engagement?uri={at-uri}
 *
 * Fetches live like / repost / reply counts for a Bluesky post URI.
 * Used to surface Bluesky engagement on Dragverse posts that were crossposted.
 *
 * Returns: { likeCount, repostCount, replyCount, quoteCount, url }
 */
export async function GET(request: NextRequest) {
  try {
    const uri = request.nextUrl.searchParams.get("uri");

    if (!uri || !uri.startsWith("at://")) {
      return NextResponse.json(
        { error: "Valid Bluesky AT-URI required (at://...)" },
        { status: 400 }
      );
    }

    const agent = await getBlueskyAgent();

    const res = await agent.getPosts({ uris: [uri] });

    if (!res.data.posts || res.data.posts.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = res.data.posts[0];

    // Derive the bsky.app URL from the AT-URI (at://did/app.bsky.feed.post/rkey)
    const parts = uri.split("/");
    const rkey = parts[parts.length - 1];
    const authorHandle = post.author.handle;
    const bskyUrl = `https://bsky.app/profile/${authorHandle}/post/${rkey}`;

    return NextResponse.json(
      {
        likeCount: post.likeCount ?? 0,
        repostCount: post.repostCount ?? 0,
        replyCount: post.replyCount ?? 0,
        quoteCount: (post as any).quoteCount ?? 0,
        url: bskyUrl,
        author: {
          handle: authorHandle,
          displayName: post.author.displayName ?? authorHandle,
          avatar: post.author.avatar ?? null,
        },
      },
      {
        headers: {
          // Cache 2 min — engagement counts change frequently
          "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[bluesky/engagement] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement" },
      { status: 500 }
    );
  }
}
