import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * GET /api/debug/creator
 * Debug endpoint to check user's creator record
 */
export async function GET(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();

    // Look up creator by DID
    const { data: creator, error } = await supabase
      .from("creators")
      .select("*")
      .eq("did", auth.userId)
      .single();

    // Also check posts
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, creator_did, creator_id, created_at")
      .eq("creator_did", auth.userId)
      .limit(10);

    return NextResponse.json({
      userId: auth.userId,
      creator: creator || null,
      creatorError: error?.message || null,
      posts: posts || [],
      postsError: postsError?.message || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
