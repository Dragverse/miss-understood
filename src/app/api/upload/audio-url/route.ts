import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export const dynamic = 'force-dynamic';

const VALID_AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];

/**
 * POST /api/upload/audio-url
 * Returns a signed upload URL for direct client-to-Supabase audio upload.
 * This bypasses Vercel's 4.5MB body limit.
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  if (isPrivyConfigured()) {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: "Authentication required to upload audio.", errorType: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.log("[AudioUpload] Authenticated user:", auth.userId);
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Authentication system unavailable.", errorType: "AUTH_UNAVAILABLE" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { fileName } = body;

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { error: "File name is required", errorType: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate audio file extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext || !VALID_AUDIO_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid audio format. Supported: ${VALID_AUDIO_EXTENSIONS.join(', ')}`, errorType: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const safeName = `${timestamp}-${randomStr}.${ext}`;
    const filePath = `audio/${safeName}`;

    const supabase = getSupabaseServerClient();

    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error("[AudioUpload] Failed to create signed URL:", error);
      return NextResponse.json(
        { error: "Failed to create upload URL", details: error?.message },
        { status: 500 }
      );
    }

    // Get public URL for playback after upload
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    console.log(`[AudioUpload] ✅ Signed URL created for: ${filePath}`);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl,
    });
  } catch (error) {
    console.error("[AudioUpload] Error:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
