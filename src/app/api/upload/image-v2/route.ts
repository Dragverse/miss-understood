import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { supabase } from "@/lib/supabase/client";

// Force dynamic route
export const dynamic = 'force-dynamic';

// Increase body size limit for image uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Image Upload API Route
 * Handles profile image and banner uploads to Livepeer IPFS
 * Requires authentication via Privy access token
 * @route POST /api/upload/image
 */

export async function POST(request: NextRequest) {
  // Verify authentication
  if (isPrivyConfigured()) {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        {
          error: "Authentication required to upload images.",
          errorType: "UNAUTHORIZED"
        },
        { status: 401 }
      );
    }
    console.log("[ImageUpload] Authenticated user:", auth.userId);
  } else {
    console.log("[ImageUpload] Privy not configured - skipping auth check");
  }

  // Check Supabase
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Image upload is currently unavailable. Please contact support.",
        errorType: "CONFIG_ERROR"
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided", errorType: "VALIDATION_ERROR" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Only JPG, PNG, WebP, and GIF are supported.",
          errorType: "INVALID_FILE_TYPE"
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: "File size exceeds 10MB. Please compress your image.",
          errorType: "FILE_TOO_LARGE",
          maxSizeMB: 10
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${randomStr}.${extension}`;
    const filePath = `images/${fileName}`;

    // Convert file to arrayBuffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({
        error: "Failed to upload image to storage",
        errorType: "UPLOAD_FAILED",
        details: uploadError.message
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      return NextResponse.json({ error: "Upload succeeded but no URL returned.", errorType: "MISSING_URL" }, { status: 500 });
    }

    console.log(`[ImageUpload] ✅ Image uploaded successfully: ${publicUrl}`);
    return NextResponse.json({ success: true, url: publicUrl, path: filePath });
  } catch (error) {
    console.error("Unexpected error during image upload:", error);
    return NextResponse.json(
      {
        error: "Unexpected error during upload.",
        errorType: "UNKNOWN_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
