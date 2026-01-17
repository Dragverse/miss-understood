import { NextRequest, NextResponse } from "next/server";

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

export async function POST(request: NextRequest) {
  // Check API key first
  if (!LIVEPEER_API_KEY) {
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
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Only JPG, PNG, and WebP are supported.",
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

    // Upload to Livepeer
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const response = await fetch("https://livepeer.studio/api/asset/upload/direct", {
      method: "POST",
      headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
      body: uploadFormData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to upload image.";
      let errorType = "UPLOAD_FAILED";

      if (response.status === 401) {
        errorMessage = "Storage authentication failed. Contact support.";
        errorType = "AUTH_FAILED";
      } else if (response.status === 429) {
        errorMessage = "Upload rate limit exceeded. Try again in a few minutes.";
        errorType = "RATE_LIMIT";
      } else if (response.status >= 500) {
        errorMessage = "Storage service unavailable. Try again later.";
        errorType = "SERVICE_UNAVAILABLE";
      }

      return NextResponse.json({ error: errorMessage, errorType }, { status: response.status });
    }

    const data = await response.json();
    const ipfsUrl = data.storage?.ipfs?.cid
      ? `https://ipfs.livepeer.studio/ipfs/${data.storage.ipfs.cid}`
      : data.url || data.playbackUrl;

    if (!ipfsUrl) {
      return NextResponse.json({ error: "Upload succeeded but no URL returned.", errorType: "MISSING_URL" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: ipfsUrl, ipfsUrl, asset: data });
  } catch (error) {
    return NextResponse.json({ error: "Unexpected error during upload.", errorType: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
