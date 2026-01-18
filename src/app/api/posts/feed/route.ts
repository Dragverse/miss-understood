import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

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
          verified
        )
      `)
      .eq("visibility", "public")
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

    return NextResponse.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0,
    });
  } catch (error) {
    console.error("Posts feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
