/**
 * Bluesky cross-posting utilities
 * Posts content to Bluesky using user's authenticated session from Privy
 */

import { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";

interface BlueskyPostParams {
  text: string;
  media?: {
    url: string;
    alt?: string;
  }[];
}

interface BlueskyPostResult {
  success: boolean;
  uri?: string;
  cid?: string;
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
    const response = new Response();
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky?.handle || !session.bluesky?.appPassword) {
      return {
        success: false,
        error: "Bluesky not connected. Please connect your Bluesky account first."
      };
    }

    const { handle, appPassword } = session.bluesky;

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
      return {
        success: false,
        error: "Failed to authenticate with Bluesky. Please reconnect your account."
      };
    }

    const authData = await authResponse.json();
    const { accessJwt, did } = authData;

    // Upload images if provided
    const embeds: any[] = [];
    if (params.media && params.media.length > 0) {
      const images = await Promise.all(
        params.media.slice(0, 4).map(async (media) => {
          try {
            // Download image from URL
            const imageResponse = await fetch(media.url);
            const imageBuffer = await imageResponse.arrayBuffer();
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
