/**
 * Farcaster cross-posting utilities
 * Uses free Warpcast sharing method (no Neynar required)
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
  userId: string; // User's DID to check Farcaster connection
}

interface FarcasterPostResult {
  success: boolean;
  openWarpcast: boolean; // Always true for free Warpcast sharing
  warpcastUrl?: string; // URL to open Warpcast
  error?: string;
}

/**
 * Prepare Farcaster post using free Warpcast sharing
 * Opens Warpcast in a new tab with pre-filled message
 */
export async function postToFarcaster(
  params: FarcasterPostParams
): Promise<FarcasterPostResult> {
  try {
    // Check if user has Farcaster connected
    const { data: creator, error: dbError } = await supabase
      .from("creators")
      .select("farcaster_fid")
      .eq("did", params.userId)
      .single();

    if (dbError || !creator?.farcaster_fid) {
      return {
        success: false,
        openWarpcast: false,
        error: "Farcaster not connected. Please connect your Farcaster account first."
      };
    }

    // Create Warpcast URL with pre-filled message
    // Warpcast URL format: https://warpcast.com/~/compose?text=...&embeds[]=...
    const encodedText = encodeURIComponent(params.text);

    let warpcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`;

    // Add media embeds (Warpcast supports embeds via URL parameter)
    if (params.media && params.media.length > 0) {
      params.media.slice(0, 2).forEach((media, index) => {
        warpcastUrl += `&embeds[]=${encodeURIComponent(media.url)}`;
      });
    }

    console.log("[Farcaster] Using free Warpcast sharing method");
    console.log("[Farcaster] Warpcast URL:", warpcastUrl);

    return {
      success: true,
      openWarpcast: true,
      warpcastUrl
    };
  } catch (error) {
    console.error("[Farcaster] Error preparing Warpcast share:", error);
    return {
      success: false,
      openWarpcast: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
