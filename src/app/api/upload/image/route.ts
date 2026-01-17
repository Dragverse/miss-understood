import { NextRequest, NextResponse } from "next/server";

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

export async function POST(request: NextRequest) {
  if (!LIVEPEER_API_KEY) {
    return NextResponse.json(
      { error: "Livepeer API key not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Upload to Livepeer IPFS
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const response = await fetch(
      "https://livepeer.studio/api/asset/upload/direct",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LIVEPEER_API_KEY}`,
        },
        body: uploadFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Livepeer upload failed:", error);
      return NextResponse.json(
        { error: "Failed to upload to Livepeer" },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Construct IPFS URL from response
    // Livepeer returns either an IPFS CID or direct URL
    const ipfsUrl = data.storage?.ipfs?.cid
      ? `https://ipfs.livepeer.studio/ipfs/${data.storage.ipfs.cid}`
      : data.url || data.playbackUrl;

    return NextResponse.json({
      success: true,
      ipfsUrl,
      asset: data,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 }
    );
  }
}
