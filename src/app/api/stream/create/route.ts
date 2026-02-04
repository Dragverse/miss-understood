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

    // Check if user already has an active stream (one stream per profile limit)
    if (userId) {
      try {
        const { data: existingStreams, error: checkError } = await supabase
          .from("streams")
          .select("id, livepeer_stream_id, title")
          .eq("creator_did", userId)
          .eq("is_active", true)
          .limit(1);

        if (!checkError && existingStreams && existingStreams.length > 0) {
          return NextResponse.json(
            {
              error: "You already have an active stream",
              activeStream: {
                id: existingStreams[0].livepeer_stream_id,
                title: existingStreams[0].title
              }
            },
            { status: 409 } // Conflict
          );
        }
      } catch (error) {
        console.warn("Could not check for existing streams:", error);
        // Continue anyway if check fails
      }
    }

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
    let databaseId: string | null = null;
    if (userId) {
      try {
        const { data: insertedStream, error: dbError } = await supabase
          .from("streams")
          .insert({
            creator_did: userId,
            livepeer_stream_id: stream.id,
            stream_key: stream.streamKey,
            playback_id: stream.playbackId,
            playback_url: playbackUrl,
            rtmp_ingest_url: rtmpIngestUrl,
            title: name,
            is_active: false, // Stream starts inactive until user goes live
          })
          .select("id")
          .single();

        if (dbError) {
          console.error("Failed to save stream to database:", dbError);

          // If table doesn't exist, warn but continue
          if (dbError.message?.includes("relation") && dbError.message?.includes("does not exist")) {
            console.warn("⚠️ Streams table does not exist. Run supabase-migration-streams.sql to enable database tracking.");
          }
          // Continue anyway - stream was created successfully in Livepeer
        } else if (insertedStream) {
          databaseId = insertedStream.id;
          console.log(`✅ Stream saved to database with ID: ${databaseId}`);
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
        // Continue anyway - stream creation was successful
      }
    }

    // Return stream details with database ID (if available) or fallback to Livepeer ID
    return NextResponse.json({
      id: databaseId || stream.id, // Use database UUID if available, fallback to Livepeer ID
      livepeerStreamId: stream.id, // Also include Livepeer ID for reference
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
