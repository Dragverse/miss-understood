/**
 * Farcaster cross-posting utilities
 * Uses Neynar's managed signer API for reliable posting
 */

import { getSigner } from "@/lib/farcaster/signer";

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
 * Post to Farcaster using Neynar's managed signer API
 * Requires user to have an approved signer (approved via Warpcast)
 */
export async function postToFarcaster(
  params: FarcasterPostParams
): Promise<FarcasterPostResult> {
  try {
    console.log("[Farcaster] Attempting cast creation via Neynar...");

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

    // The encryptedPrivateKey field stores the Neynar signer UUID
    const signerUuid = signer.encryptedPrivateKey;

    // Prepare embeds (convert media URLs to embed format)
    const embeds = params.media?.map((m) => ({ url: m.url })) || [];

    // Post via Neynar API
    const neynarResponse = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": process.env.NEYNAR_API_KEY || "",
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: params.text,
        embeds: embeds.length > 0 ? embeds : undefined,
      }),
    });

    if (!neynarResponse.ok) {
      const errorData = await neynarResponse.json();
      console.error("[Farcaster] ❌ Neynar API error:", errorData);
      return {
        success: false,
        error: errorData.message || "Failed to post cast",
      };
    }

    const castData = await neynarResponse.json();
    const castHash = castData.cast?.hash;

    console.log(`[Farcaster] ✅ Cast published successfully!`);
    console.log(`[Farcaster] Hash: ${castHash}`);

    return {
      success: true,
      hash: castHash,
    };
  } catch (error) {
    console.error("[Farcaster] Posting error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
