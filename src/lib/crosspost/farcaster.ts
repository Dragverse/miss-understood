/**
 * Farcaster cross-posting utilities
 * Uses native signing with custom signer management (no Neynar required)
 */

import { createCast, getSigner } from "@/lib/farcaster/signer";

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
  hash?: string; // Cast hash
  error?: string;
  needsSetup?: boolean; // True if user needs to set up signer
}

/**
 * Post to Farcaster using native signing
 * Requires user to have a registered signer (approved via Warpcast)
 */
export async function postToFarcaster(
  params: FarcasterPostParams
): Promise<FarcasterPostResult> {
  try {
    console.log("[Farcaster] Attempting native cast creation...");

    // Check if user has a signer set up
    const signer = await getSigner(params.userId);

    if (!signer) {
      console.log("[Farcaster] No signer found for user");
      return {
        success: false,
        needsSetup: true,
        error: "Farcaster posting not set up. Please enable native posting in settings.",
      };
    }

    // Prepare embeds
    const embeds = params.media?.map((m) => ({ url: m.url })) || [];

    // Create and broadcast cast
    const result = await createCast(params.userId, params.text, embeds);

    if (result.success) {
      console.log(`[Farcaster] ✅ Cast published successfully!`);
      console.log(`[Farcaster] Hash: ${result.hash}`);

      return {
        success: true,
        hash: result.hash,
      };
    } else {
      console.error("[Farcaster] ❌ Cast failed:", result.error);
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    console.error("[Farcaster] Posting error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
