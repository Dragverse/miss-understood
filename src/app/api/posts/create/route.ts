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

    // Look up or create creator by DID
    let creatorId: string | null = null;

    // First try to find existing creator
    const { data: existingCreator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (existingCreator) {
      creatorId = existingCreator.id;
    } else {
      // Create new creator with basic info
      // Generate a handle from the DID (last segment)
      const didParts = userDID.split(":");
      const shortId = didParts[didParts.length - 1]?.substring(0, 8) || "user";

      const { data: newCreator, error: creatorError } = await supabase
        .from("creators")
        .insert({
          did: userDID,
          handle: shortId,
          display_name: `User ${shortId}`,
          avatar: "/defaultpfp.png",
          verified: false,
        })
        .select("id")
        .single();

      if (newCreator) {
        creatorId = newCreator.id;
        console.log(`[Posts] Created new creator for DID ${userDID}: ${creatorId}`);
      } else {
        console.warn(`[Posts] Failed to create creator: ${creatorError?.message}`);
      }
    }

    // Create post with both creator_did and creator_id
    const { data: post, error: createError } = await supabase
      .from("posts")
      .insert({
        creator_did: userDID,
        creator_id: creatorId,
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
