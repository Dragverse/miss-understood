import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * POST /api/posts/create
 * Create a new post (photo, thought, or both)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    let userDID = "anonymous";

    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userDID = auth.userId || "anonymous";
    }

    const body = await request.json();
    const {
      textContent,
      mediaUrls = [],
      mediaTypes = [],
      mood,
      backgroundColor,
      textAlignment = "left",
      tags = [],
      mentionedDids = [],
      location,
      visibility = "public",
      scheduledAt,
    } = body;

    // Validate: must have either text or media
    if (!textContent?.trim() && mediaUrls.length === 0) {
      return NextResponse.json(
        { error: "Post must have either text content or media" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Create post
    const { data: post, error: createError } = await supabase
      .from("posts")
      .insert({
        creator_did: userDID,
        text_content: textContent || null,
        media_urls: mediaUrls,
        media_types: mediaTypes,
        mood,
        background_color: backgroundColor,
        text_alignment: textAlignment,
        tags,
        mentioned_dids: mentionedDids,
        location,
        visibility,
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create post:", createError);
      return NextResponse.json(
        { error: "Failed to create post" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Post creation error:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
