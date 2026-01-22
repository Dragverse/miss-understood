import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateCreator } from "@/lib/supabase/creators";
import type { CreateCreatorInput } from "@/lib/supabase/creators";
import { verifyAuth } from "@/lib/auth/verify";

export async function POST(request: NextRequest) {
  try {
    // CRITICAL FIX: Add authentication
    const auth = await verifyAuth(request);

    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.handle || !body.displayName) {
      return NextResponse.json(
        { success: false, error: "Handle and display name are required" },
        { status: 400 }
      );
    }

    // Validate DID is provided
    if (!body.did) {
      return NextResponse.json(
        { success: false, error: "User ID (DID) is required" },
        { status: 400 }
      );
    }

    // Ensure user can only update their own profile
    if (body.did !== auth.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Cannot update another user's profile" },
        { status: 403 }
      );
    }

    const creatorInput: CreateCreatorInput = {
      did: body.did, // CRITICAL FIX: Include DID for upsert to work
      handle: body.handle,
      display_name: body.displayName,
      description: body.description || "",
      avatar: body.avatar,
      banner: body.banner,
      website: body.website,
      instagram_handle: body.instagramHandle,
      tiktok_handle: body.tiktokHandle,
    };

    console.log(`[ProfileUpdate] Updating profile for user ${auth.userId}`);

    // Save to Supabase
    const creatorDoc = await createOrUpdateCreator(creatorInput);

    console.log(`[ProfileUpdate] ✅ Profile updated successfully for ${creatorDoc.id}`);

    return NextResponse.json({
      success: true,
      creatorId: creatorDoc.id,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update profile"
      },
      { status: 500 }
    );
  }
}
