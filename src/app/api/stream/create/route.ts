import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, createStreamSchema } from "@/lib/validation/schemas";
import { createClient } from "@supabase/supabase-js";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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
    }

    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(createStreamSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Create livestream on Livepeer with multi-bitrate profiles
    const response = await fetch(`${LIVEPEER_API_URL}/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        profiles: [
          {
            name: "720p",
            bitrate: 2000000,
            fps: 30,
            width: 1280,
            height: 720,
          },
          {
            name: "480p",
            bitrate: 1000000,
            fps: 30,
            width: 854,
            height: 480,
          },
          {
            name: "360p",
            bitrate: 500000,
            fps: 30,
            width: 640,
            height: 360,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Livepeer stream creation error:", await response.text());
      return NextResponse.json(
        { error: "Failed to create livestream" },
        { status: response.status }
      );
    }

    const stream = await response.json();

    const playbackUrl = `https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`;
    const rtmpIngestUrl = `rtmp://rtmp.livepeer.com/live/${stream.streamKey}`;

    // Save stream metadata to database
    if (userId) {
      try {
        const { error: dbError } = await supabase.from("streams").insert({
          creator_did: userId,
          livepeer_stream_id: stream.id,
          stream_key: stream.streamKey,
          playback_id: stream.playbackId,
          playback_url: playbackUrl,
          rtmp_ingest_url: rtmpIngestUrl,
          title: name,
          is_active: false, // Stream starts inactive until user goes live
        });

        if (dbError) {
          console.error("Failed to save stream to database:", dbError);

          // If table doesn't exist, warn but continue
          if (dbError.message?.includes("relation") && dbError.message?.includes("does not exist")) {
            console.warn("⚠️ Streams table does not exist. Run supabase-migration-streams.sql to enable database tracking.");
          }
          // Continue anyway - stream was created successfully in Livepeer
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
        // Continue anyway - stream creation was successful
      }
    }

    // Return stream details
    return NextResponse.json({
      id: stream.id,
      streamKey: stream.streamKey,
      playbackId: stream.playbackId,
      playbackUrl,
      rtmpIngestUrl,
    });
  } catch (error) {
    console.error("Stream creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
