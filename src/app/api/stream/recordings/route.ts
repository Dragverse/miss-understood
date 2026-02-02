import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/recordings
 * Fetch all recordings for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    // Query user's stream recordings
    const { data: recordings, error } = await supabase
      .from("stream_recordings")
      .select("*")
      .eq("creator_did", userId)
      .order("recorded_at", { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch recordings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      recordings: recordings || [],
    });
  } catch (error) {
    console.error("Recordings fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stream/recordings?id={recordingId}
 * Delete a specific recording
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const searchParams = request.nextUrl.searchParams;
    const recordingId = searchParams.get("id");

    if (!recordingId) {
      return NextResponse.json(
        { error: "Recording ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership and delete
    const { error } = await supabase
      .from("stream_recordings")
      .delete()
      .eq("id", recordingId)
      .eq("creator_did", userId);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete recording" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recording deleted successfully",
    });
  } catch (error) {
    console.error("Recording delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stream/recordings
 * Update recording metadata (publish, unpublish, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await request.json();
    const { recordingId, action, videoId } = body;

    if (!recordingId || !action) {
      return NextResponse.json(
        { error: "Recording ID and action are required" },
        { status: 400 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case "publish":
        if (!videoId) {
          return NextResponse.json(
            { error: "Video ID required for publish action" },
            { status: 400 }
          );
        }
        updateData = {
          is_published: true,
          published_video_id: videoId,
        };
        break;

      case "unpublish":
        updateData = {
          is_published: false,
          published_video_id: null,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update recording
    const { error } = await supabase
      .from("stream_recordings")
      .update(updateData)
      .eq("id", recordingId)
      .eq("creator_did", userId);

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update recording" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Recording ${action}ed successfully`,
    });
  } catch (error) {
    console.error("Recording update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
