/**
 * Bluesky cross-posting utilities
 * Posts content to Bluesky using user's authenticated session from Privy
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

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
  params: BlueskyPostParams
): Promise<BlueskyPostResult> {
  try {
    // Get Bluesky session from iron-session
    // Must use NextResponse (same as connect route) for cookie compatibility
    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    console.log("[Bluesky Crosspost] ========== SESSION DEBUG ==========");
    console.log("[Bluesky Crosspost] Request cookies:", request.cookies.getAll().map(c => c.name));
    console.log("[Bluesky Crosspost] Session object:", session);
    console.log("[Bluesky Crosspost] Session.bluesky exists:", !!session.bluesky);
    console.log("[Bluesky Crosspost] Session.bluesky.handle:", session.bluesky?.handle);
    console.log("[Bluesky Crosspost] Session.bluesky.appPassword length:", session.bluesky?.appPassword?.length);

    if (!session.bluesky?.handle || !session.bluesky?.appPassword) {
      console.error("[Bluesky Crosspost] ❌ No Bluesky session found in cookie.");
      console.error("[Bluesky Crosspost] This means the user either:");
      console.error("[Bluesky Crosspost] 1. Never connected Bluesky");
      console.error("[Bluesky Crosspost] 2. Session expired (7 day limit)");
      console.error("[Bluesky Crosspost] 3. Cookies are being blocked/cleared");
      return {
        success: false,
        error: "Bluesky not connected. Please reconnect your Bluesky account in Settings."
      };
    }

    const { handle, appPassword } = session.bluesky;
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
            const thumbBlobData = new Blob([thumbBuffer], {
              type: thumbResponse.headers.get("content-type") || "image/jpeg"
            });

            const uploadResponse = await fetch(
              "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
              {
                method: "POST",
                headers: {
                  "Content-Type": thumbBlobData.type,
                  Authorization: `Bearer ${accessJwt}`,
                },
                body: thumbBlobData,
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
            const imageBlob = new Blob([imageBuffer], {
              type: imageResponse.headers.get("content-type") || "image/jpeg"
            });

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
