import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import sharp from "sharp";

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
  // Verify authentication - FAIL-CLOSED: require auth even if Privy not configured in production
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
  } else if (process.env.NODE_ENV === "production") {
    // In production, reject uploads if auth system is not configured
    console.error("[ImageUpload] CRITICAL: Privy not configured in production - rejecting upload");
    return NextResponse.json(
      {
        error: "Authentication system unavailable. Please try again later.",
        errorType: "AUTH_UNAVAILABLE"
      },
      { status: 503 }
    );
  } else {
    console.warn("[ImageUpload] Privy not configured - allowing unauthenticated upload in development only");
  }

  try {
    // Get Supabase server client
    const supabase = getSupabaseServerClient();

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

    // Convert file to arrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Optimize image (skip GIFs to preserve animation)
    let optimizedBuffer: Buffer;
    let outputContentType: string;
    let outputExtension: string;

    if (file.type === "image/gif") {
      optimizedBuffer = inputBuffer;
      outputContentType = file.type;
      outputExtension = "gif";
    } else {
      const originalSize = inputBuffer.byteLength;
      optimizedBuffer = await sharp(inputBuffer)
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      outputContentType = "image/webp";
      outputExtension = "webp";
      console.log(`[ImageUpload] Optimized: ${(originalSize / 1024).toFixed(0)}KB → ${(optimizedBuffer.byteLength / 1024).toFixed(0)}KB`);
    }

    const fileName = `${timestamp}-${randomStr}.${outputExtension}`;
    const filePath = `images/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, optimizedBuffer, {
        contentType: outputContentType,
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
