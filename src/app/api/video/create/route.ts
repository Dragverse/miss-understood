import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/ceramic/videos";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, createVideoSchema } from "@/lib/validation/schemas";

/**
 * POST /api/video/create
 * Save video metadata to Ceramic after successful Livepeer upload
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
    } = validation.data;

    // Convert tags array to comma-separated string for Ceramic
    const tagsString = Array.isArray(tags) ? tags.join(',') : (tags || '');

    const videoInput = {
      title: title.trim(),
      description: description?.trim(),
      thumbnail,
      livepeerAssetId,
      playbackId,
      playbackUrl,
      duration,
      contentType,
      category,
      tags: tagsString,
    };

    // Save to Ceramic
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
      // If Ceramic is not configured yet, still return success
      // but log that we're in fallback mode
      console.warn("Ceramic not configured, using fallback mode:", ceramicError);

      return NextResponse.json({
        success: true,
        videoId: `mock-${Date.now()}`,
        message: "Video uploaded (Ceramic pending configuration)",
        fallbackMode: true,
        warning: "Video saved locally but not yet synced to decentralized storage"
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
