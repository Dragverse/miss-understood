import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;
    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Livepeer API key not configured" },
        { status: 500 }
      );
    }

    // Query Livepeer API for stream status
    const response = await fetch(`${LIVEPEER_API_URL}/stream/${streamId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Stream not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch stream status" },
        { status: response.status }
      );
    }

    const stream = await response.json();

    return NextResponse.json({
      id: stream.id,
      name: stream.name,
      isActive: stream.isActive || false,
      playbackId: stream.playbackId,
      playbackUrl: stream.playbackId
        ? `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`
        : null,
      createdAt: stream.createdAt,
      lastSeen: stream.lastSeen,
    });
  } catch (error) {
    console.error("Stream status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    // Verify authentication
    let userId: string | undefined;
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      userId = auth.userId;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { streamId } = await params;
    const { is_active } = await request.json();

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: "is_active must be a boolean" },
        { status: 400 }
      );
    }

    // Verify stream ownership before updating
    const { data: stream, error: fetchError } = await supabase
      .from("streams")
      .select("creator_did")
      .eq("id", streamId)
      .single();

    if (fetchError || !stream) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      );
    }

    if (stream.creator_did !== userId) {
      return NextResponse.json(
        { error: "Not authorized to update this stream" },
        { status: 403 }
      );
    }

    // Update is_active status
    const { data, error } = await supabase
      .from("streams")
      .update({
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq("id", streamId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update stream status:", error);
      return NextResponse.json(
        { error: "Failed to update stream status" },
        { status: 500 }
      );
    }

    console.log(`✅ Stream ${streamId} status updated: is_active=${is_active}`);

    return NextResponse.json({
      success: true,
      stream: data
    });

  } catch (error) {
    console.error("Stream status update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
