import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { postToBluesky } from "@/lib/crosspost/bluesky";

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
      crosspostThumbnail, // Thumbnail for crossposting only (not stored in Dragverse post)
      mood,
      backgroundColor,
      textAlignment = "left",
      tags = [],
      mentionedDids = [],
      location,
      visibility = "public",
      scheduledAt,
      platforms = { dragverse: true, bluesky: false },
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

    console.log("[Posts] ✅ Dragverse post created:", post.id);

    // Cross-post to other platforms if requested
    const crosspostResults: Record<string, { success: boolean; error?: string; url?: string; uri?: string; cid?: string; hash?: string; openWarpcast?: boolean }> = {
      dragverse: { success: true, url: `/posts/${post.id}` },
    };

    // Fetch creator info for username in crosspost message
    const { data: creator } = await supabase
      .from("creators")
      .select("username, handle")
      .eq("did", userDID)
      .single();

    const username = creator?.username || creator?.handle || "a creator";
    const postUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dragverse.app'}/posts/${post.id}`;

    // Check if text already contains a watch/listen link (video/audio post)
    const hasVideoLink = textContent && (textContent.includes('/watch/') || textContent.includes('/listen/'));

    // Format crosspost message
    // For video/audio posts, use text as-is (already has link)
    // For regular posts, append Dragverse link
    const crosspostText = hasVideoLink
      ? textContent // Video/audio posts already have the link
      : textContent
        ? `${textContent}\n\nWatch @${username} at the Dragverse: ${postUrl}`
        : `Check out this post from @${username} at the Dragverse: ${postUrl}`;

    // Cross-post to Bluesky
    console.log("[Posts] ========== CROSSPOSTING DEBUG ==========");
    console.log("[Posts] Platforms received:", platforms);
    console.log("[Posts] Bluesky enabled:", platforms.bluesky);
    console.log("[Posts] User DID:", userDID);
    console.log("[Posts] Crosspost text:", crosspostText);

    if (platforms.bluesky) {
      console.log("[Posts] Cross-posting to Bluesky...");
      try {
        // Check if this is a video/audio post by looking for watch/listen URLs in text
        const isVideoPost = textContent && (textContent.includes('/watch/') || textContent.includes('/listen/'));

        // Extract video URL and metadata for external embed
        let blueskyParams: any = { text: crosspostText };

        if (isVideoPost && (crosspostThumbnail || mediaUrls.length > 0)) {
          // Extract video URL from text
          const urlMatch = textContent.match(/https?:\/\/[^\s]+\/(watch|listen)\/[^\s]+/);
          const videoUrl = urlMatch ? urlMatch[0] : postUrl;

          // Extract title (first line of text before description)
          const lines = textContent.split('\n');
          const title = lines[0]?.trim() || "Watch on Dragverse";
          const description = lines.slice(1).join('\n').trim().substring(0, 200) || "New content on Dragverse";

          // Use external embed for video/audio posts (creates clickable link card)
          blueskyParams.external = {
            uri: videoUrl,
            title: title,
            description: description,
            thumb: crosspostThumbnail || mediaUrls[0], // Use crosspost thumbnail or first media URL
          };
        } else if (mediaUrls.length > 0) {
          // Use image embeds for regular posts
          blueskyParams.media = mediaUrls.map((url: string, index: number) => ({
            url,
            alt: `Image ${index + 1}`,
          }));
        }

        const blueskyResult = await postToBluesky(request, blueskyParams);

        crosspostResults.bluesky = blueskyResult;
        if (blueskyResult.success) {
          console.log("[Posts] ✅ Bluesky post created:", blueskyResult.uri);
        } else {
          console.error("[Posts] ❌ Bluesky post failed:", blueskyResult.error);
        }
      } catch (error) {
        console.error("[Posts] ❌ Bluesky error:", error);
        crosspostResults.bluesky = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Update post with crosspost tracking info
    const crosspostedTo: string[] = [];
    const updateData: any = { crossposted_to: crosspostedTo };

    if (crosspostResults.bluesky?.success && crosspostResults.bluesky.uri) {
      crosspostedTo.push('bluesky');
      updateData.bluesky_post_uri = crosspostResults.bluesky.uri;
    }

    if (crosspostedTo.length > 0) {
      await supabase
        .from("posts")
        .update(updateData)
        .eq("id", post.id);
      console.log("[Posts] ✅ Updated crosspost tracking:", crosspostedTo);
    }

    // Return success even if cross-posting partially fails
    return NextResponse.json({
      success: true,
      post: { ...post, crosspostedTo },
      crosspost: crosspostResults,
    });
  } catch (error) {
    console.error("Post creation error:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
