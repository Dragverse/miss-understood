import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/supabase/videos";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, createVideoSchema } from "@/lib/validation/schemas";

/**
 * POST /api/video/create
 * Save video metadata to Ceramic after successful Livepeer upload
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get user DID
    let userDID = "anonymous";

    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userDID = auth.userId || "anonymous";
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(createVideoSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      title,
      description,
      thumbnail,
      livepeerAssetId,
      playbackId,
      playbackUrl,
      duration,
      contentType,
      category,
      tags,
      visibility,
    } = validation.data;

    // Tags in Supabase is an array, no conversion needed
    const tagsArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

    const videoInput = {
      creator_did: userDID,
      title: title.trim(),
      description: description?.trim(),
      thumbnail,
      livepeer_asset_id: livepeerAssetId,
      playback_id: playbackId,
      playback_url: playbackUrl,
      duration,
      content_type: contentType,
      category,
      tags: tagsArray,
      visibility: visibility || "public",
    };

    // Save to Supabase
    try {
      const videoDoc = await createVideo(videoInput);

      if (!videoDoc || !videoDoc.id) {
        throw new Error("Failed to create video document in Ceramic");
      }

      return NextResponse.json({
        success: true,
        videoId: videoDoc.id,
        message: "Video metadata saved successfully",
      });
    } catch (ceramicError) {
      // If Ceramic is not configured yet, return video data for localStorage
      console.warn("Ceramic not configured, using localStorage fallback:", ceramicError);

      // Generate stable video ID
      const videoId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create video object matching Video type for client-side storage
      const videoData = {
        id: videoId,
        title: title.trim(),
        description: description?.trim() || "",
        thumbnail: thumbnail || "",
        duration: duration || 0,
        views: 0,
        likes: 0,
        createdAt: new Date(),
        playback_url: playbackUrl || `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`,
        livepeer_asset_id: livepeerAssetId,
        content_type: contentType,
        category,
        tags: tagsArray,
        creator: {
          did: "local",
          handle: "you",
          displayName: "Your Profile",
          avatar: "",
          description: "",
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date(),
          verified: false
        },
        source: "local" as const
      };

      return NextResponse.json({
        success: true,
        videoId,
        message: "Video uploaded successfully (local storage)",
        fallbackMode: true,
        videoData
      });
    }
  } catch (error) {
    console.error("Video creation error:", error);
    return NextResponse.json(
      { error: "Failed to save video metadata" },
      { status: 500 }
    );
  }
}
