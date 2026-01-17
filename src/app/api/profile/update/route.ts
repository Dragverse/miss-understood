import { NextResponse } from "next/server";
import { createOrUpdateCreator } from "@/lib/ceramic/creators";
import type { CreateCreatorInput } from "@/lib/ceramic/creators";

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
      displayName: body.displayName,
      description: body.description || "",
      avatar: body.avatar,
      banner: body.banner,
      website: body.website,
      instagramHandle: body.instagramHandle,
      tiktokHandle: body.tiktokHandle,
    };

    try {
      // Try to save to Ceramic
      const creatorDoc = await createOrUpdateCreator(creatorInput);

      return NextResponse.json({
        success: true,
        creatorId: creatorDoc.id,
        message: "Profile updated successfully"
      });
    } catch (ceramicError) {
      // If Ceramic is not configured yet, still return success
      console.warn("Ceramic not configured, using fallback mode:", ceramicError);

      // Store in localStorage on client (will be synced when Ceramic becomes available)
      return NextResponse.json({
        success: true,
        creatorId: `temp-${Date.now()}`,
        message: "Profile updated (Ceramic pending configuration)",
        fallbackMode: true,
        profileData: creatorInput
      });
    }
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
