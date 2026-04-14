import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
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

    // If the ID is a Supabase UUID, look up the Livepeer stream ID first
    let livepeerStreamId = streamId;
    if (UUID_REGEX.test(streamId)) {
      const { data: streamRecord } = await supabase
        .from("streams")
        .select("livepeer_stream_id")
        .eq("id", streamId)
        .single();

      if (!streamRecord?.livepeer_stream_id) {
        return NextResponse.json(
          { error: "Stream not found" },
          { status: 404 }
        );
      }
      livepeerStreamId = streamRecord.livepeer_stream_id;
    }

    // Query Livepeer API for stream status
    const response = await fetch(`${LIVEPEER_API_URL}/stream/${livepeerStreamId}`, {
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
    const body = await request.json();
    const { is_active, livepeerStreamId, playbackId, title } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: "is_active must be a boolean" },
        { status: 400 }
      );
    }

    // Look up stream — try UUID first, then Livepeer stream ID as fallback.
    // The modal may have received the Livepeer ID if the DB insert failed during creation.
    let streamRow: { id: string; creator_did: string } | null = null;

    const { data: byUuid } = await supabase
      .from("streams")
      .select("id, creator_did")
      .eq("id", streamId)
      .maybeSingle();

    if (byUuid) {
      streamRow = byUuid;
    } else {
      // Fallback: try matching on the livepeer_stream_id column
      const { data: byLivepeer } = await supabase
        .from("streams")
        .select("id, creator_did")
        .eq("livepeer_stream_id", streamId)
        .maybeSingle();
      if (byLivepeer) streamRow = byLivepeer;
    }

    // Self-heal: if no DB row exists but we have enough info, insert one now.
    // This covers the case where the stream-creation DB insert failed silently.
    if (!streamRow) {
      const healPlaybackId = playbackId as string | undefined;
      const healLivepeerStreamId = (livepeerStreamId as string | undefined) ?? streamId;

      if (healPlaybackId) {
        const playbackUrl = `https://livepeercdn.studio/hls/${healPlaybackId}/index.m3u8`;
        const { data: inserted, error: insertError } = await supabase
          .from("streams")
          .insert({
            creator_did: userId,
            livepeer_stream_id: healLivepeerStreamId,
            playback_id: healPlaybackId,
            playback_url: playbackUrl,
            title: (title as string | undefined) ?? "Live Stream",
            is_active: false,
          })
          .select("id, creator_did")
          .single();

        if (!insertError && inserted) {
          console.log(`🔧 Self-healed: inserted missing stream row ${inserted.id} for creator ${userId}`);
          streamRow = inserted;
        } else {
          console.error("Self-heal insert failed:", insertError);
          return NextResponse.json({ error: "Stream not found and could not be created" }, { status: 404 });
        }
      } else {
        return NextResponse.json(
          { error: "Stream not found" },
          { status: 404 }
        );
      }
    }

    if (streamRow.creator_did !== userId) {
      return NextResponse.json(
        { error: "Not authorized to update this stream" },
        { status: 403 }
      );
    }

    // Update is_active status using the real Supabase UUID
    const realId = streamRow.id;
    const updatePayload: Record<string, unknown> = {
      is_active,
      updated_at: new Date().toISOString(),
    };
    if (is_active) updatePayload.started_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("streams")
      .update(updatePayload)
      .eq("id", realId)
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
