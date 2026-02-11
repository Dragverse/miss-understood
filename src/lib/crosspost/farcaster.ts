/**
 * Farcaster cross-posting utilities
 * Uses FREE Warpcast share intents - no API required
 */

interface FarcasterPostParams {
  text: string;
  media?: {
    url: string;
    alt?: string;
  }[];
  userId: string; // User's DID
}

interface FarcasterPostResult {
  success: boolean;
  warpcastUrl?: string; // Warpcast compose URL to open
  error?: string;
  needsSetup?: boolean; // True if user needs to connect Farcaster
}

/**
 * Generate Warpcast share intent URL
 * This is 100% FREE - just opens Warpcast with pre-filled content
 */
export async function postToFarcaster(
  params: FarcasterPostParams
): Promise<FarcasterPostResult> {
  try {
    console.log("[Farcaster] Generating Warpcast share URL...");

    // Build Warpcast compose URL with pre-filled content
    const baseUrl = "https://warpcast.com/~/compose";
    const urlParams = new URLSearchParams();

    // Add text
    urlParams.set("text", params.text);

    // Add embeds (images/videos)
    if (params.media && params.media.length > 0) {
      params.media.forEach((media, index) => {
        urlParams.append("embeds[]", media.url);
      });
    }

    // Add channel (dragverse)
    urlParams.set("channelKey", "dragverse");

    const warpcastUrl = `${baseUrl}?${urlParams.toString()}`;

    console.log("[Farcaster] ✅ Warpcast share URL generated");
    console.log("[Farcaster] URL:", warpcastUrl);

    return {
      success: true,
      warpcastUrl,
    };
  } catch (error) {
    console.error("[Farcaster] Error generating share URL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
