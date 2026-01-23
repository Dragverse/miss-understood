import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * POST /api/posts/backfill-creators
 * Backfill creator_id for posts that only have creator_did
 * Also creates creator records for DIDs that don't exist
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication - only allow authenticated users to trigger for their own posts
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 500 }
      );
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();

    // Find posts by this user that don't have creator_id set
    const { data: postsToFix, error: fetchError } = await supabase
      .from("posts")
      .select("id, creator_did")
      .eq("creator_did", auth.userId)
      .is("creator_id", null);

    if (fetchError) {
      console.error("Failed to fetch posts:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    if (!postsToFix || postsToFix.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No posts need backfilling",
        fixed: 0,
      });
    }

    // Check if creator exists for this DID
    let { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", auth.userId)
      .single();

    // If no creator exists, create one
    if (!creator) {
      const didParts = auth.userId.split(":");
      const shortId = didParts[didParts.length - 1]?.substring(0, 8) || "user";

      const { data: newCreator, error: creatorError } = await supabase
        .from("creators")
        .insert({
          did: auth.userId,
          handle: shortId,
          display_name: `User ${shortId}`,
          avatar: "/defaultpfp.png",
          verified: false,
        })
        .select("id")
        .single();

      if (creatorError) {
        console.error("Failed to create creator:", creatorError);
        return NextResponse.json(
          { error: "Failed to create creator record" },
          { status: 500 }
        );
      }

      creator = newCreator;
      console.log(`[Backfill] Created creator for ${auth.userId}: ${creator?.id}`);
    }

    // Update all posts with the creator_id
    const { error: updateError, count } = await supabase
      .from("posts")
      .update({ creator_id: creator?.id })
      .eq("creator_did", auth.userId)
      .is("creator_id", null);

    if (updateError) {
      console.error("Failed to update posts:", updateError);
      return NextResponse.json(
        { error: "Failed to update posts" },
        { status: 500 }
      );
    }

    console.log(`[Backfill] Fixed ${postsToFix.length} posts for ${auth.userId}`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${postsToFix.length} posts`,
      fixed: postsToFix.length,
      creatorId: creator?.id,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Failed to backfill posts" },
      { status: 500 }
    );
  }
}
