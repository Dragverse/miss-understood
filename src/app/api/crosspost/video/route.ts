import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { postToBluesky } from "@/lib/crosspost/bluesky";
import { postToFarcaster } from "@/lib/crosspost/farcaster";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/crosspost/video
 * Unified server-side crossposting for video uploads
 *
 * Request body:
 * - videoId: string
 * - title: string
 * - description?: string
 * - thumbnailUrl?: string
 * - platforms: { bluesky?: boolean, farcaster?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, title, description, thumbnailUrl, platforms } = body;

    if (!videoId || !title) {
      return NextResponse.json(
        { error: "videoId and title required" },
        { status: 400 }
      );
    }

    // Fetch creator info to get username
    const supabase = getSupabaseServerClient();
    const { data: creator } = await supabase
      .from("creators")
      .select("username, handle")
      .eq("did", auth.userId)
      .single();

    const username = creator?.username || creator?.handle || "a creator";
    const videoUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/watch/${videoId}`;

    // Format: "Watch @username at the Dragverse: [link]"
    // Include title and description for context
    const postText = `${title}\n\n${description || ""}\n\nWatch @${username} at the Dragverse: ${videoUrl}`;

    // Default thumbnail for audio and videos without thumbnails
    const DEFAULT_THUMBNAIL = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dragverse.app'}/default-thumbnail.jpg`;

    const results: any = {
      dragverse: { success: true, videoId },
    };

    // Crosspost to Bluesky
    if (platforms.bluesky) {
      // Use custom thumbnail only if it's a valid HTTP(S) URL (not blob URLs or relative paths)
      const mediaUrl = thumbnailUrl && thumbnailUrl.startsWith("http") && !thumbnailUrl.startsWith("blob:")
        ? thumbnailUrl
        : DEFAULT_THUMBNAIL;
      console.log("[Crosspost Video] Posting to Bluesky...");
      console.log("[Crosspost Video] Thumbnail URL:", thumbnailUrl);
      console.log("[Crosspost Video] Using media URL:", mediaUrl);
      console.log("[Crosspost Video] Post text:", postText);
      try {
        const blueskyResult = await postToBluesky(request, {
          text: postText,
          media: [{
            url: mediaUrl,
            alt: `${title} - Watch on Dragverse`,
          }],
        });
        results.bluesky = blueskyResult;

        if (blueskyResult.success) {
          console.log("[Crosspost Video] ✅ Posted to Bluesky:", blueskyResult.uri);
        } else {
          console.error("[Crosspost Video] ❌ Bluesky failed:", blueskyResult.error);
        }
      } catch (error) {
        console.error("[Crosspost Video] Bluesky error:", error);
        results.bluesky = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Crosspost to Farcaster
    if (platforms.farcaster) {
      console.log("[Crosspost Video] Posting to Farcaster...");
      try {
        // Use custom thumbnail only if it's a valid HTTP(S) URL (not blob URLs or relative paths)
        const farcasterMediaUrl = thumbnailUrl && thumbnailUrl.startsWith("http") && !thumbnailUrl.startsWith("blob:")
          ? thumbnailUrl
          : DEFAULT_THUMBNAIL;
        const farcasterResult = await postToFarcaster({
          text: postText,
          media: [{
            url: farcasterMediaUrl,
            alt: `${title} - Watch on Dragverse`,
          }],
          userId: auth.userId!, // Safe: already verified auth.authenticated above
        });
        results.farcaster = farcasterResult;

        if (farcasterResult.success) {
          console.log("[Crosspost Video] ✅ Posted to Farcaster:", farcasterResult.hash);
        } else {
          console.error("[Crosspost Video] ❌ Farcaster failed:", farcasterResult.error);
        }
      } catch (error) {
        console.error("[Crosspost Video] Farcaster error:", error);
        results.farcaster = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[Crosspost Video] Error:", error);
    return NextResponse.json(
      { error: "Crosspost failed" },
      { status: 500 }
    );
  }
}
