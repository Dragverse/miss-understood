import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIVEPEER_API_URL = "https://livepeer.studio/api";

interface LivepeerSession {
  id: string;
  recordingStatus: "ready" | "waiting" | "none";
  recordingUrl?: string;
  playbackId?: string;
  duration?: number;
}

/**
 * POST /api/stream/save-recording
 *
 * Saves a finished livestream as a video entry in the `videos` table.
 *
 * Body: { streamId, livepeerStreamId, playbackId, title, description? }
 *
 * Flow:
 * 1. Verify auth
 * 2. Try to fetch Livepeer recording sessions for the stream and pick the
 *    first session with recordingStatus='ready'. Falls back to the stream's
 *    own playbackId when no ready session is found or the API call fails.
 * 3. Insert a row into `videos` with content_type='live'.
 * 4. Mark the stream row as published (is_published=true) in `streams`.
 * 5. Return { success, videoId }.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    // Parse request body
    const body = await request.json();
    const { streamId, livepeerStreamId, playbackId, title, description } = body;

    if (!livepeerStreamId || !playbackId || !title) {
      return NextResponse.json(
        { error: "Missing required fields: livepeerStreamId, playbackId, title" },
        { status: 400 }
      );
    }

    // 2. Try to fetch Livepeer recording sessions to get the recording playbackId
    let recordingPlaybackId: string = playbackId;

    const apiKey = process.env.LIVEPEER_API_KEY;
    if (apiKey) {
      try {
        const sessionsRes = await fetch(
          `${LIVEPEER_API_URL}/stream/${livepeerStreamId}/sessions?record=1`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (sessionsRes.ok) {
          const sessions: LivepeerSession[] = await sessionsRes.json();
          const readySession = sessions.find(
            (s) => s.recordingStatus === "ready" && s.playbackId
          );

          if (readySession?.playbackId) {
            recordingPlaybackId = readySession.playbackId;
            console.log(
              `[save-recording] Using recording session playbackId: ${recordingPlaybackId}`
            );
          } else {
            console.log(
              `[save-recording] No ready recording session found — using stream playbackId: ${recordingPlaybackId}`
            );
          }
        } else {
          console.warn(
            `[save-recording] Livepeer sessions fetch failed (${sessionsRes.status}) — falling back to stream playbackId`
          );
        }
      } catch (err) {
        console.warn(
          "[save-recording] Error fetching Livepeer sessions — falling back to stream playbackId:",
          err
        );
      }
    } else {
      console.warn(
        "[save-recording] LIVEPEER_API_KEY not set — skipping recording session lookup"
      );
    }

    const playbackUrl = `https://livepeercdn.studio/hls/${recordingPlaybackId}/index.m3u8`;

    // 3. Look up creator_id from creator_did (userId)
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userId)
      .maybeSingle();

    if (creatorError) {
      console.error("[save-recording] Creator lookup failed:", creatorError);
      return NextResponse.json(
        { error: "Failed to look up creator" },
        { status: 500 }
      );
    }

    if (!creator) {
      console.error("[save-recording] No creator found for DID:", userId);
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // 4. Insert into videos table
    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        creator_id: creator.id,
        creator_did: userId,
        title,
        description: description ?? null,
        playback_id: recordingPlaybackId,
        playback_url: playbackUrl,
        content_type: "live",
        visibility: "public",
        views: 0,
        likes: 0,
        tip_count: 0,
        total_tips_usd: 0,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[save-recording] Video insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to save recording as video" },
        { status: 500 }
      );
    }

    console.log(
      `[save-recording] Video created: ${video.id} for stream ${streamId ?? livepeerStreamId}`
    );

    // 5. Mark the stream as published (best-effort — don't fail on error)
    if (streamId) {
      const { error: updateError } = await supabase
        .from("streams")
        .update({ is_published: true })
        .eq("id", streamId);

      if (updateError) {
        console.warn(
          "[save-recording] Failed to mark stream as published:",
          updateError
        );
      } else {
        console.log(`[save-recording] Stream ${streamId} marked as published`);
      }
    }

    return NextResponse.json({ success: true, videoId: video.id });
  } catch (error) {
    console.error("[save-recording] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
