import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyAuthFromCookies } from "@/lib/auth/verify";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";

export async function POST(request: NextRequest) {
  try {
    const auth =
      (await verifyAuthFromCookies(request).catch(() => null)) ||
      (await verifyAuth(request).catch(() => null));

    if (!auth?.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const blueskyDID = await getBlueskyOAuthDID(auth.userId);
    if (!blueskyDID) {
      return NextResponse.json(
        { error: "No active Bluesky connection. Please connect in Settings.", requiresConnection: true },
        { status: 401 }
      );
    }

    const agent = await getOAuthAgent(blueskyDID);
    if (!agent) {
      return NextResponse.json(
        { error: "Bluesky session expired. Please reconnect in Settings.", requiresConnection: true },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, images } = body;

    if (!text?.trim() && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Post must have text or images" },
        { status: 400 }
      );
    }

    const postData: any = {
      text: text?.trim() || "",
      createdAt: new Date().toISOString(),
    };

    if (images && images.length > 0) {
      const imageBlobs = [];

      for (const imageUrl of images) {
        try {
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to fetch image: ${imageUrl}`);
            continue;
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const imageData = new Uint8Array(imageBuffer);
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

          const upload = await agent.uploadBlob(imageData, {
            encoding: contentType,
          });

          imageBlobs.push({
            alt: "",
            image: upload.data.blob,
          });
        } catch (error) {
          console.error("Failed to upload image to Bluesky:", error);
        }
      }

      if (imageBlobs.length > 0) {
        postData.embed = {
          $type: "app.bsky.embed.images",
          images: imageBlobs,
        };
      }
    }

    const post = await agent.post(postData);

    return NextResponse.json({
      success: true,
      uri: post.uri,
      cid: post.cid,
    });
  } catch (error) {
    console.error("Bluesky post error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create post",
      },
      { status: 500 }
    );
  }
}
