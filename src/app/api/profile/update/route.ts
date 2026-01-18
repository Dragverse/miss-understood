import { NextResponse } from "next/server";
import { createOrUpdateCreator } from "@/lib/supabase/creators";
import type { CreateCreatorInput } from "@/lib/supabase/creators";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.handle || !body.displayName) {
      return NextResponse.json(
        { success: false, error: "Handle and display name are required" },
        { status: 400 }
      );
    }

    const creatorInput: CreateCreatorInput = {
      handle: body.handle,
      display_name: body.displayName,
      description: body.description || "",
      avatar: body.avatar,
      banner: body.banner,
      website: body.website,
      instagram_handle: body.instagramHandle,
      tiktok_handle: body.tiktokHandle,
    };

    // Save to Supabase
    const creatorDoc = await createOrUpdateCreator(creatorInput);

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
