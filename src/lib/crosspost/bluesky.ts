/**
 * Bluesky cross-posting utilities
 * Posts content to Bluesky using OAuth session (preferred) or legacy app password
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { createClient } from "@supabase/supabase-js";
import { getBlueskyOAuthDID, getOAuthAgent } from "@/lib/bluesky/oauth-client";
import { Agent, RichText } from "@atproto/api";

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

  try {
    const sharp = (await import("sharp")).default;

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
  // Build embed
  let embed: any = undefined;

  if (params.external) {
    // External link embed (for video/audio link cards)
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
    // Image embeds
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

  // Create post
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
 * Post to Bluesky using user's session (OAuth preferred, legacy fallback)
 */
export async function postToBluesky(
  request: NextRequest,
  params: BlueskyPostParams,
  userDID?: string
): Promise<BlueskyPostResult> {
  try {
    // 1. Try OAuth agent first
    if (userDID) {
      const blueskyOAuthDID = await getBlueskyOAuthDID(userDID);
      if (blueskyOAuthDID) {
        const agent = await getOAuthAgent(blueskyOAuthDID);
        if (agent) {
          console.log("[Bluesky Crosspost] Using OAuth agent for:", blueskyOAuthDID);
          return await postWithOAuthAgent(agent, params);
        }
      }
    }

    // 2. Fall back to legacy app password flow
    let handle: string | undefined;
    let appPassword: string | undefined;

    // Try iron-session cookie
    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (session.bluesky?.handle && session.bluesky?.appPassword) {
      handle = session.bluesky.handle;
      appPassword = session.bluesky.appPassword;
    }

    // Fall back to DB credentials
    if ((!handle || !appPassword) && userDID) {
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
        }
      } catch (dbError) {
        console.error("[Bluesky Crosspost] DB fallback failed:", dbError);
      }
    }

    if (!handle || !appPassword) {
      return {
        success: false,
        error: "Bluesky not connected. Please connect your Bluesky account in Settings."
      };
    }

    console.log("[Bluesky Crosspost] Using legacy auth for:", handle);

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

    if (params.external) {
      let thumbBlob = null;
      if (params.external.thumb) {
        try {
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
            }
          }
        } catch (error) {
          console.error("[Bluesky] Failed to upload thumbnail:", error);
        }
      }

      const externalEmbed: any = {
        uri: params.external.uri,
        title: params.external.title,
        description: params.external.description,
      };
      if (thumbBlob) externalEmbed.thumb = thumbBlob;

      embeds.push({
        $type: "app.bsky.embed.external",
        external: externalEmbed,
      });
    } else if (params.media && params.media.length > 0) {
      const images = await Promise.all(
        params.media.slice(0, 4).map(async (media) => {
          try {
            const imageResponse = await fetch(media.url);
            if (!imageResponse.ok) return null;

            const imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            const imageBlob = await compressImageForBluesky(imageBuffer, contentType);

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

            if (!uploadResponse.ok) return null;

            const uploadData = await uploadResponse.json();
            return { alt: media.alt || "", image: uploadData.blob };
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

    const record: any = {
      $type: "app.bsky.feed.post",
      text: params.text,
      createdAt: new Date().toISOString(),
    };
    if (embeds.length > 0) record.embed = embeds[0];

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
      return { success: false, error: `Failed to post to Bluesky: ${errorText}` };
    }

    const postData = await postResponse.json();
    console.log("[Bluesky] Post successful:", postData.uri);
    return { success: true, uri: postData.uri, cid: postData.cid };
  } catch (error) {
    console.error("[Bluesky] Error posting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Delete a post from Bluesky using user's session (OAuth preferred, legacy fallback)
 */
export async function deleteFromBluesky(
  request: NextRequest,
  postUri: string,
  userDID?: string
): Promise<BlueskyDeleteResult> {
  try {
    // Parse post URI to get rkey: at://did:plc:xxx/app.bsky.feed.post/RKEY
    const uriParts = postUri.split('/');
    const rkey = uriParts[uriParts.length - 1];

    // 1. Try OAuth agent first
    if (userDID) {
      const blueskyOAuthDID = await getBlueskyOAuthDID(userDID);
      if (blueskyOAuthDID) {
        const agent = await getOAuthAgent(blueskyOAuthDID);
        if (agent) {
          await agent.deletePost(postUri);
          console.log("[Bluesky OAuth] Post deleted successfully");
          return { success: true };
        }
      }
    }

    // 2. Fall back to legacy iron-session
    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky?.handle || !session.bluesky?.appPassword) {
      return { success: false, error: "Bluesky not connected" };
    }

    const { handle, appPassword } = session.bluesky;

    const authResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });

    if (!authResponse.ok) {
      return { success: false, error: "Failed to authenticate with Bluesky" };
    }

    const authData = await authResponse.json();
    const { accessJwt, did } = authData;

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
      return { success: false, error: `Failed to delete from Bluesky: ${errorText}` };
    }

    console.log("[Bluesky] Post deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("[Bluesky] Error deleting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
