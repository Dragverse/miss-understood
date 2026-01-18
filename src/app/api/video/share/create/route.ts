import { NextRequest, NextResponse } from "next/server";
import { createShareToken } from "@/lib/utils/share-tokens";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/video/share/create
 * Generates a share token for a video
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
    } else {
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { videoId, expiresIn, maxViews } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    // Verify user owns the video
    const supabase = getSupabaseServerClient();
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("creator_did")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.creator_did !== userDID) {
      return NextResponse.json(
        { error: "You can only create share links for your own videos" },
        { status: 403 }
      );
    }

    // Generate share token
    const result = await createShareToken(videoId, userDID, {
      expiresIn: expiresIn || undefined,
      maxViews: maxViews || undefined,
    });

    return NextResponse.json({
      success: true,
      token: result.token,
      shareUrl: result.shareUrl,
      tokenData: result.tokenData,
    });
  } catch (error) {
    console.error("Error creating share token:", error);
    return NextResponse.json(
      { error: "Failed to create share token" },
      { status: 500 }
    );
  }
}
