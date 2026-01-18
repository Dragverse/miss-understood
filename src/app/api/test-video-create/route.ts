import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/supabase/videos";
import { getCreatorByDID, createOrUpdateCreator } from "@/lib/supabase/creators";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * POST /api/test-video-create
 * Test endpoint to diagnose video creation issues
 */
export async function POST(request: NextRequest) {
  const testLog: any[] = [];

  try {
    testLog.push({ step: "1. Starting test", timestamp: new Date().toISOString() });

    // Check Privy configuration
    const privyConfigured = isPrivyConfigured();
    testLog.push({ step: "2. Privy configured", value: privyConfigured });

    // Verify authentication
    let userDID = "test-user-123";
    if (privyConfigured) {
      testLog.push({ step: "3. Verifying auth" });
      const auth = await verifyAuth(request);
      testLog.push({ step: "4. Auth result", authenticated: auth.authenticated, userId: auth.userId, error: auth.error });

      if (!auth.authenticated) {
        return NextResponse.json({
          success: false,
          error: "Authentication failed",
          testLog,
          authError: auth.error
        }, { status: 401 });
      }
      userDID = auth.userId || "anonymous";
    }

    testLog.push({ step: "5. Using DID", userDID });

    // Check if creator exists
    testLog.push({ step: "6. Looking up creator" });
    let creator = await getCreatorByDID(userDID);
    testLog.push({ step: "7. Creator lookup result", exists: !!creator, creatorId: creator?.id });

    // Create creator if doesn't exist
    if (!creator) {
      testLog.push({ step: "8. Creating creator" });
      try {
        creator = await createOrUpdateCreator({
          did: userDID,
          handle: `test-${userDID.substring(0, 8)}`,
          display_name: "Test User",
          avatar: "",
          description: "Test creator",
        });
        testLog.push({ step: "9. Creator created", creatorId: creator.id });
      } catch (creatorError) {
        testLog.push({
          step: "9. Creator creation failed",
          error: creatorError instanceof Error ? creatorError.message : String(creatorError)
        });
        throw creatorError;
      }
    }

    // Try to create a test video
    testLog.push({ step: "10. Creating test video" });
    const videoInput = {
      creator_did: userDID,
      title: "Test Video " + Date.now(),
      description: "This is a test video",
      thumbnail: "https://example.com/thumb.jpg",
      playback_url: "https://example.com/video.m3u8",
      duration: 60,
      content_type: "short" as const,
      category: "test",
      tags: ["test"],
      visibility: "public" as const,
    };

    testLog.push({ step: "11. Video input prepared", input: videoInput });

    const videoDoc = await createVideo(videoInput);
    testLog.push({
      step: "12. Video created successfully",
      videoId: videoDoc.id,
      creatorId: videoDoc.creator_id
    });

    return NextResponse.json({
      success: true,
      message: "Test video created successfully",
      videoId: videoDoc.id,
      creatorId: creator.id,
      testLog,
    });

  } catch (error) {
    testLog.push({
      step: "ERROR",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      testLog,
    }, { status: 500 });
  }
}

/**
 * GET /api/test-video-create
 * Show test instructions
 */
export async function GET() {
  return NextResponse.json({
    message: "Test endpoint for video creation",
    instructions: "Send a POST request with Authorization: Bearer <token> header to test video creation",
    example: {
      method: "POST",
      headers: {
        "Authorization": "Bearer YOUR_PRIVY_TOKEN",
        "Content-Type": "application/json"
      }
    }
  });
}
