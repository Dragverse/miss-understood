/**
 * Bluesky cross-posting utilities
 * Posts content to Bluesky using user's authenticated session from Privy
 * Falls back to DB-stored credentials when session cookie is missing/expired
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BLUESKY_MAX_BLOB_SIZE = 950_000; // ~950KB (Bluesky limit is 976.56KB, leave margin)

/**
 * Compress an image buffer to fit within Bluesky's blob size limit
 */
async function compressImageForBluesky(buffer: ArrayBuffer, contentType: string): Promise<Blob> {
  const inputBuffer = Buffer.from(buffer);

  // If already small enough, return as-is
  if (inputBuffer.byteLength <= BLUESKY_MAX_BLOB_SIZE) {
    return new Blob([new Uint8Array(buffer)], { type: contentType });
  }

  console.log(`[Bluesky] Image too large (${(inputBuffer.byteLength / 1024).toFixed(0)}KB), compressing...`);

  // Try progressive quality reduction
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
 * Post to Bluesky using user's session
 */
export async function postToBluesky(
  request: NextRequest,
  params: BlueskyPostParams,
  userDID?: string
): Promise<BlueskyPostResult> {
  try {
    // Try iron-session first, then fall back to DB credentials
    let handle: string | undefined;
    let appPassword: string | undefined;

    // 1. Try iron-session cookie
    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (session.bluesky?.handle && session.bluesky?.appPassword) {
      handle = session.bluesky.handle;
      appPassword = session.bluesky.appPassword;
      console.log("[Bluesky Crosspost] ✅ Using session cookie credentials for:", handle);
    }

    // 2. Fall back to DB credentials if session is missing/expired
    if ((!handle || !appPassword) && userDID) {
      console.log("[Bluesky Crosspost] Session cookie missing, trying DB fallback for DID:", userDID);
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: creator } = await supabase
          .from("creators")
          .select("bluesky_handle, bluesky_app_password")
          .eq("did", userDID)
          .single();

        if (creator?.bluesky_handle && creator?.bluesky_app_password) {
          handle = creator.bluesky_handle;
          appPassword = creator.bluesky_app_password;
          console.log("[Bluesky Crosspost] ✅ Using DB fallback credentials for:", handle);
        }
      } catch (dbError) {
        console.error("[Bluesky Crosspost] DB fallback failed:", dbError);
      }
    }

    if (!handle || !appPassword) {
      console.error("[Bluesky Crosspost] ❌ No credentials found (session or DB).");
      return {
        success: false,
        error: "Bluesky not connected. Please reconnect your Bluesky account in Settings."
      };
    }

    console.log("[Bluesky Crosspost] Authenticating as:", handle);

    // Authenticate with Bluesky to get access token
    const authResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: handle,
        password: appPassword,
      }),
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text().catch(() => "Unknown auth error");
      console.error("[Bluesky Crosspost] Auth failed:", authResponse.status, authError);
      return {
        success: false,
        error: "Failed to authenticate with Bluesky. Please reconnect your account in Settings."
      };
    }

    const authData = await authResponse.json();
    const { accessJwt, did } = authData;

    // Handle embeds
    const embeds: any[] = [];

    // External link embed (for video/audio posts with link cards)
    if (params.external) {
      console.log("[Bluesky] Creating external link embed:", params.external.uri);

      // Upload thumbnail for external embed if provided
      let thumbBlob = null;
      if (params.external.thumb) {
        try {
          console.log("[Bluesky] Downloading thumbnail for external embed:", params.external.thumb);
          const thumbResponse = await fetch(params.external.thumb);
          if (thumbResponse.ok) {
            const thumbBuffer = await thumbResponse.arrayBuffer();
            const contentType = thumbResponse.headers.get("content-type") || "image/jpeg";
            const compressedBlob = await compressImageForBluesky(thumbBuffer, contentType);

            const uploadResponse = await fetch(
              "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
              {
                method: "POST",
                headers: {
                  "Content-Type": compressedBlob.type,
                  Authorization: `Bearer ${accessJwt}`,
                },
                body: compressedBlob,
              }
            );

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              thumbBlob = uploadData.blob;
              console.log("[Bluesky] ✓ Thumbnail uploaded for external embed");
            }
          }
        } catch (error) {
          console.error("[Bluesky] Failed to upload thumbnail for external:", error);
        }
      }

      // Build external embed object
      const externalEmbed: any = {
        uri: params.external.uri,
        title: params.external.title,
        description: params.external.description,
      };

      // Only include thumb if upload succeeded
      if (thumbBlob) {
        externalEmbed.thumb = thumbBlob;
      }

      embeds.push({
        $type: "app.bsky.embed.external",
        external: externalEmbed,
      });
    }
    // Image embeds (for regular photo posts)
    else if (params.media && params.media.length > 0) {
      const images = await Promise.all(
        params.media.slice(0, 4).map(async (media) => {
          try {
            // Download image from URL
            console.log("[Bluesky] Fetching image from:", media.url);
            const imageResponse = await fetch(media.url);

            if (!imageResponse.ok) {
              console.error(`[Bluesky] Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
              return null;
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            console.log("[Bluesky] Image downloaded, size:", imageBuffer.byteLength, "bytes");
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            const imageBlob = await compressImageForBluesky(imageBuffer, contentType);

            // Upload to Bluesky
            const uploadResponse = await fetch(
              "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
              {
                method: "POST",
                headers: {
                  "Content-Type": imageBlob.type,
                  Authorization: `Bearer ${accessJwt}`,
                },
                body: imageBlob,
              }
            );

            if (!uploadResponse.ok) {
              console.error("[Bluesky] Image upload failed:", await uploadResponse.text());
              return null;
            }

            const uploadData = await uploadResponse.json();
            return {
              alt: media.alt || "",
              image: uploadData.blob,
            };
          } catch (error) {
            console.error("[Bluesky] Error uploading image:", error);
            return null;
          }
        })
      );

      const validImages = images.filter(Boolean);
      if (validImages.length > 0) {
        embeds.push({
          $type: "app.bsky.embed.images",
          images: validImages,
        });
      }
    }

    // Create post record
    const record: any = {
      $type: "app.bsky.feed.post",
      text: params.text,
      createdAt: new Date().toISOString(),
    };

    if (embeds.length > 0) {
      record.embed = embeds[0];
    }

    // Post to Bluesky
    const postResponse = await fetch(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessJwt}`,
        },
        body: JSON.stringify({
          repo: did,
          collection: "app.bsky.feed.post",
          record,
        }),
      }
    );

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("[Bluesky] Post failed:", errorText);
      return {
        success: false,
        error: `Failed to post to Bluesky: ${errorText}`
      };
    }

    const postData = await postResponse.json();
    console.log("[Bluesky] Post successful:", postData.uri);

    return {
      success: true,
      uri: postData.uri,
      cid: postData.cid
    };
  } catch (error) {
    console.error("[Bluesky] Error posting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Delete a post from Bluesky using user's session
 */
export async function deleteFromBluesky(
  request: NextRequest,
  postUri: string
): Promise<BlueskyDeleteResult> {
  try {
    console.log("[Bluesky] Deleting post:", postUri);

    // Get Bluesky session from iron-session
    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky?.handle || !session.bluesky?.appPassword) {
      return {
        success: false,
        error: "Bluesky not connected"
      };
    }

    const { handle, appPassword } = session.bluesky;

    // Authenticate with Bluesky
    const authResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: handle,
        password: appPassword,
      }),
    });

    if (!authResponse.ok) {
      return {
        success: false,
        error: "Failed to authenticate with Bluesky"
      };
    }

    const authData = await authResponse.json();
    const { accessJwt, did } = authData;

    // Parse post URI to get rkey: at://did:plc:xxx/app.bsky.feed.post/RKEY
    const uriParts = postUri.split('/');
    const rkey = uriParts[uriParts.length - 1];

    // Delete the post
    const deleteResponse = await fetch(
      "https://bsky.social/xrpc/com.atproto.repo.deleteRecord",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessJwt}`,
        },
        body: JSON.stringify({
          repo: did,
          collection: "app.bsky.feed.post",
          rkey: rkey,
        }),
      }
    );

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error("[Bluesky] Delete failed:", errorText);
      return {
        success: false,
        error: `Failed to delete from Bluesky: ${errorText}`
      };
    }

    console.log("[Bluesky] ✅ Post deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("[Bluesky] Error deleting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
