/**
 * Farcaster cross-posting utilities
 * Posts content to Farcaster using Neynar API and user's signer from Privy
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FarcasterPostParams {
  text: string;
  media?: {
    url: string;
    alt?: string;
  }[];
  userId: string; // User's DID to lookup signer
}

interface FarcasterPostResult {
  success: boolean;
  hash?: string;
  error?: string;
}

/**
 * Post to Farcaster using Neynar API
 */
export async function postToFarcaster(
  params: FarcasterPostParams
): Promise<FarcasterPostResult> {
  try {
    if (!process.env.NEYNAR_API_KEY) {
      return {
        success: false,
        error: "Neynar API key not configured"
      };
    }

    // Get user's Farcaster signer UUID from database
    const { data: creator, error: dbError } = await supabase
      .from("creators")
      .select("farcaster_signer_uuid, farcaster_fid")
      .eq("did", params.userId)
      .single();

    if (dbError || !creator?.farcaster_signer_uuid || !creator?.farcaster_fid) {
      return {
        success: false,
        error: "Farcaster not connected. Please connect your Farcaster account first."
      };
    }

    const { farcaster_signer_uuid } = creator;

    // Prepare cast data
    const castData: any = {
      signer_uuid: farcaster_signer_uuid,
      text: params.text,
    };

    // Handle media embeds
    if (params.media && params.media.length > 0) {
      // Farcaster supports image embeds via URL
      castData.embeds = params.media.slice(0, 2).map((media) => ({
        url: media.url,
      }));
    }

    // Post cast using Neynar API
    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": process.env.NEYNAR_API_KEY,
      },
      body: JSON.stringify(castData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Farcaster] Cast failed:", errorText);
      return {
        success: false,
        error: `Failed to post to Farcaster: ${errorText}`
      };
    }

    const castResponse = await response.json();
    console.log("[Farcaster] Cast successful:", castResponse.cast?.hash);

    return {
      success: true,
      hash: castResponse.cast?.hash
    };
  } catch (error) {
    console.error("[Farcaster] Error posting:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
