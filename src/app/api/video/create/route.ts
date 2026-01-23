import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/supabase/videos";
import { getCreatorByDID, createOrUpdateCreator } from "@/lib/supabase/creators";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, createVideoSchema } from "@/lib/validation/schemas";
import {
  getPrivyUserProfile,
  extractDisplayName,
  extractHandle,
  extractAvatar,
  extractSocialHandles,
} from "@/lib/privy/server";

// Configure route to accept larger request bodies (for audio uploads with thumbnails)
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic'; // Disable static optimization

/**
 * POST /api/video/create
 * Save video metadata to Ceramic after successful Livepeer upload
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get user DID
    let userDID = "anonymous";

    console.log("[Video Create] Privy configured:", isPrivyConfigured());

    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      console.log("[Video Create] Auth result:", { authenticated: auth.authenticated, userId: auth.userId, error: auth.error });

      if (!auth.authenticated) {
        console.error("[Video Create] ❌ Authentication failed:", auth.error);

        // In development, allow test users for debugging
        if (process.env.NODE_ENV === "development") {
          const body = await request.json();
          if (body._testUserId) {
            userDID = body._testUserId;
            console.log("[Video Create] Using test user ID (dev mode):", userDID);

            // Re-create request with body for later parsing
            request = new NextRequest(request.url, {
              method: request.method,
              headers: request.headers,
              body: JSON.stringify(body),
            });
          } else {
            return NextResponse.json(
              { error: "Authentication required. Please log in to upload videos." },
              { status: 401 }
            );
          }
        } else {
          // Production: authentication is required
          return NextResponse.json(
            { error: "Authentication required. Please log in to upload videos." },
            { status: 401 }
          );
        }
      } else {
        userDID = auth.userId || "anonymous";
        console.log("[Video Create] ✅ Authenticated as:", userDID);
      }
    } else {
      console.log("[Video Create] ⚠️ Privy not configured, using anonymous mode");
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

    // Ensure creator exists in database before creating video
    // CRITICAL: Video insert will fail if creator doesn't exist (foreign key constraint)
    let creator = await getCreatorByDID(userDID);

    if (!creator) {
      console.log(`[VideoCreate] Creator not found for DID: ${userDID}, creating new creator`);

      try {
        // Fetch full user profile from Privy to get actual display name, handle, avatar
        const privyUser = await getPrivyUserProfile(userDID);

        let creatorData;
        if (privyUser) {
          console.log("[VideoCreate] ✅ Fetched Privy user profile");
          creatorData = {
            did: userDID,
            handle: extractHandle(privyUser, userDID),
            display_name: extractDisplayName(privyUser),
            avatar: extractAvatar(privyUser, userDID),
            description: "",
            ...extractSocialHandles(privyUser),
          };
          console.log("[VideoCreate] Using profile data:", {
            handle: creatorData.handle,
            display_name: creatorData.display_name,
            avatar: creatorData.avatar,
          });
        } else {
          console.warn("[VideoCreate] ⚠️ Failed to fetch Privy profile, cannot create creator");
          return NextResponse.json(
            { error: "Failed to create user profile. Please ensure you're logged in correctly." },
            { status: 500 }
          );
        }

        creator = await createOrUpdateCreator(creatorData);
        console.log(`[VideoCreate] ✅ Creator created successfully:`, creator.id);
      } catch (creatorError) {
        console.error(`[VideoCreate] ❌ Failed to create creator:`, creatorError);
        return NextResponse.json(
          { error: "Failed to create user profile. Please try syncing your profile in settings.", details: creatorError instanceof Error ? creatorError.message : String(creatorError) },
          { status: 500 }
        );
      }
    } else {
      console.log("[VideoCreate] ✅ Creator exists:", creator.id);
    }

    // Verify creator exists before proceeding
    if (!creator || !creator.id) {
      console.error("[VideoCreate] ❌ Creator validation failed");
      return NextResponse.json(
        { error: "User profile not found. Please try syncing your profile in settings." },
        { status: 400 }
      );
    }

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

    // Validate duration based on content type
    if (duration) {
      const maxDurations: { [key: string]: number } = {
        short: 1200,      // 20 minutes
        long: 3600,       // 60 minutes
        podcast: 10800,   // 3 hours
        music: 900        // 15 minutes
      };

      const maxDuration = maxDurations[contentType];
      if (maxDuration && duration > maxDuration) {
        return NextResponse.json(
          {
            error: `${contentType} content must be ${maxDuration / 60} minutes or less`,
            errorType: "VALIDATION_ERROR"
          },
          { status: 400 }
        );
      }
    }

    // Save to Supabase
    try {
      console.log("[Video Create] Attempting to save to Supabase with creator_did:", userDID);
      const videoDoc = await createVideo(videoInput);

      if (!videoDoc || !videoDoc.id) {
        throw new Error("Failed to create video document in Supabase");
      }

      console.log("[Video Create] ✅ Video saved to Supabase successfully:", videoDoc.id);
      return NextResponse.json({
        success: true,
        videoId: videoDoc.id,
        message: "Video metadata saved successfully",
      });
    } catch (supabaseError) {
      // If Supabase fails, return video data for localStorage fallback
      console.error("[Video Create] ❌ Supabase save failed:", supabaseError);
      console.error("[Video Create] Error details:", {
        message: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
        creator_did: userDID,
        title: videoInput.title,
      });

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
        message: "Video uploaded successfully (temporary storage)",
        fallbackMode: true,
        videoData,
        warning: "Your video is saved locally. Please ensure you have a stable connection to sync it to the cloud."
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
