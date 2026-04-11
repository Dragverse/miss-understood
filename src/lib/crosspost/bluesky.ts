/**
 * Bluesky cross-posting utilities
 * Posts content to Bluesky using OAuth session
 */

import { NextRequest } from "next/server";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";
import { Agent, RichText } from "@atproto/api";

const BLUESKY_MAX_BLOB_SIZE = 950_000; // ~950KB (Bluesky limit is 976.56KB, leave margin)

/**
 * Compress an image buffer to fit within Bluesky's blob size limit
 */
async function compressImageForBluesky(buffer: ArrayBuffer, contentType: string): Promise<Blob> {
  const inputBuffer = Buffer.from(buffer);

  if (inputBuffer.byteLength <= BLUESKY_MAX_BLOB_SIZE) {
    return new Blob([new Uint8Array(buffer)], { type: contentType });
  }

  console.log(`[Bluesky] Image too large (${(inputBuffer.byteLength / 1024).toFixed(0)}KB), compressing...`);

  try {
    const sharp = (await import("sharp")).default;

    let quality = 80;
    let result = await sharp(inputBuffer)
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    while (result.byteLength > BLUESKY_MAX_BLOB_SIZE && quality > 20) {
      quality -= 15;
      result = await sharp(inputBuffer)
        .resize({ width: 1500, height: 1500, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }

    console.log(`[Bluesky] Compressed to ${(result.byteLength / 1024).toFixed(0)}KB (quality: ${quality})`);
    const ab = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer;
    return new Blob([ab], { type: "image/jpeg" });
  } catch (sharpError) {
    console.warn("[Bluesky] Sharp compression failed, using original image:", sharpError);
    return new Blob([new Uint8Array(buffer)], { type: contentType });
  }
}

interface BlueskyPostParams {
  text: string;
  media?: {
    url: string;
    alt?: string;
  }[];
  external?: {
    uri: string;
    title: string;
    description: string;
    thumb?: string;
  };
}

interface BlueskyPostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

interface BlueskyDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Post to Bluesky using OAuth agent
 */
async function postWithOAuthAgent(
  agent: Agent,
  params: BlueskyPostParams
): Promise<BlueskyPostResult> {
  let embed: any = undefined;

  if (params.external) {
    let thumbBlob = undefined;
    if (params.external.thumb) {
      try {
        const thumbResponse = await fetch(params.external.thumb);
        if (thumbResponse.ok) {
          const thumbBuffer = await thumbResponse.arrayBuffer();
          const contentType = thumbResponse.headers.get("content-type") || "image/jpeg";
          const compressedBlob = await compressImageForBluesky(thumbBuffer, contentType);
          const uint8 = new Uint8Array(await compressedBlob.arrayBuffer());
          const uploadResult = await agent.uploadBlob(uint8, { encoding: compressedBlob.type });
          thumbBlob = uploadResult.data.blob;
        }
      } catch (error) {
        console.error("[Bluesky OAuth] Failed to upload thumbnail:", error);
      }
    }

    embed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: params.external.uri,
        title: params.external.title,
        description: params.external.description,
        ...(thumbBlob ? { thumb: thumbBlob } : {}),
      },
    };
  } else if (params.media && params.media.length > 0) {
    const images = await Promise.all(
      params.media.slice(0, 4).map(async (media) => {
        try {
          const imageResponse = await fetch(media.url);
          if (!imageResponse.ok) return null;

          const imageBuffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
          const compressedBlob = await compressImageForBluesky(imageBuffer, contentType);
          const uint8 = new Uint8Array(await compressedBlob.arrayBuffer());
          const uploadResult = await agent.uploadBlob(uint8, { encoding: compressedBlob.type });

          return {
            alt: media.alt || "",
            image: uploadResult.data.blob,
          };
        } catch (error) {
          console.error("[Bluesky OAuth] Error uploading image:", error);
          return null;
        }
      })
    );

    const validImages = images.filter(Boolean);
    if (validImages.length > 0) {
      embed = {
        $type: "app.bsky.embed.images",
        images: validImages,
      };
    }
  }

  const rt = new RichText({ text: params.text });
  await rt.detectFacets(agent);

  const postResult = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed,
    createdAt: new Date().toISOString(),
  });

  console.log("[Bluesky OAuth] Post successful:", postResult.uri);
  return {
    success: true,
    uri: postResult.uri,
    cid: postResult.cid,
  };
}

/**
 * Post to Bluesky using user's OAuth session
 */
export async function postToBluesky(
  request: NextRequest,
  params: BlueskyPostParams,
  userDID?: string
): Promise<BlueskyPostResult> {
  try {
    if (!userDID) {
      return {
        success: false,
        error: "User DID required for Bluesky crosspost",
      };
    }

    const blueskyOAuthDID = await getBlueskyOAuthDID(userDID);
    if (!blueskyOAuthDID) {
      return {
        success: false,
        error: "Bluesky not connected. Please connect your Bluesky account in Settings.",
      };
    }

    const agent = await getOAuthAgent(blueskyOAuthDID);
    if (!agent) {
      return {
        success: false,
        error: "Bluesky session expired. Please reconnect in Settings.",
      };
    }

    console.log("[Bluesky Crosspost] Using OAuth agent for:", blueskyOAuthDID);
    return await postWithOAuthAgent(agent, params);
  } catch (error) {
    console.error("[Bluesky] Error posting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a post from Bluesky using user's OAuth session
 */
export async function deleteFromBluesky(
  request: NextRequest,
  postUri: string,
  userDID?: string
): Promise<BlueskyDeleteResult> {
  try {
    if (!userDID) {
      return { success: false, error: "User DID required" };
    }

    const blueskyOAuthDID = await getBlueskyOAuthDID(userDID);
    if (!blueskyOAuthDID) {
      return { success: false, error: "Bluesky not connected" };
    }

    const agent = await getOAuthAgent(blueskyOAuthDID);
    if (!agent) {
      return { success: false, error: "Bluesky session expired" };
    }

    await agent.deletePost(postUri);
    console.log("[Bluesky OAuth] Post deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("[Bluesky] Error deleting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
