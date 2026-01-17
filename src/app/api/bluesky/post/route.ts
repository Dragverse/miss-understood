import { NextRequest, NextResponse } from "next/server";
import { BskyAgent } from "@atproto/api";
import { decryptPassword } from "@/lib/utils/bluesky-auth";

const BLUESKY_SERVICE = "https://bsky.social";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, images, blueskyHandle, blueskyPassword } = body;

    if (!blueskyHandle || !blueskyPassword) {
      return NextResponse.json(
        { error: "Bluesky credentials required" },
        { status: 400 }
      );
    }

    if (!text?.trim() && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Post must have text or images" },
        { status: 400 }
      );
    }

    // Decrypt the app password
    const decryptedPassword = await decryptPassword(blueskyPassword);

    // Create Bluesky agent and login
    const agent = new BskyAgent({ service: BLUESKY_SERVICE });

    try {
      await agent.login({
        identifier: blueskyHandle,
        password: decryptedPassword,
      });
    } catch (error) {
      console.error("Bluesky login failed:", error);
      return NextResponse.json(
        { error: "Failed to authenticate with Bluesky. Please check your credentials." },
        { status: 401 }
      );
    }

    // Prepare post data
    const postData: any = {
      text: text?.trim() || "",
      createdAt: new Date().toISOString(),
    };

    // Upload and attach images if any
    if (images && images.length > 0) {
      const imageBlobs = [];

      for (const imageUrl of images) {
        try {
          // Fetch image from URL
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to fetch image: ${imageUrl}`);
            continue;
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const imageData = new Uint8Array(imageBuffer);

          // Determine content type
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

          // Upload to Bluesky
          const upload = await agent.uploadBlob(imageData, {
            encoding: contentType,
          });

          imageBlobs.push({
            alt: "",
            image: upload.data.blob,
          });
        } catch (error) {
          console.error("Failed to upload image to Bluesky:", error);
          // Continue with other images
        }
      }

      if (imageBlobs.length > 0) {
        postData.embed = {
          $type: "app.bsky.embed.images",
          images: imageBlobs,
        };
      }
    }

    // Create the post
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
