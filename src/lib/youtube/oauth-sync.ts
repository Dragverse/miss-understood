/**
 * YouTube Channel Sync
 * Connects YouTube channels via handle/URL entry using the YouTube Data API.
 * Uses API key for public channel data - no OAuth required.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YouTubeChannelInfo {
  channelId: string;
  channelName: string;
  subscriberCount: number;
  avatarUrl?: string;
  customUrl?: string;
  description?: string;
}

interface SyncResult {
  success: boolean;
  error?: string;
  channelInfo?: YouTubeChannelInfo;
  verificationCode?: string;
}

/**
 * Generate a unique verification code for YouTube channel ownership.
 * Uses unambiguous characters (no 0/O, 1/l/i).
 */
function generateVerificationCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `dragverse-${code}`;
}

/**
 * Look up a YouTube channel by handle (@username), channel ID, or URL.
 * Uses the YouTube Data API with API key (public data, no OAuth needed).
 */
export async function fetchChannelByHandleOrId(
  input: string
): Promise<YouTubeChannelInfo | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("[YouTube] YOUTUBE_API_KEY not configured");
      return null;
    }

    // Parse the input - could be a handle, channel ID, or full URL
    let channelId: string | null = null;
    let handle: string | null = null;

    const trimmed = input.trim();

    if (trimmed.startsWith("UC") && trimmed.length >= 20) {
      channelId = trimmed;
    } else if (trimmed.startsWith("@")) {
      handle = trimmed;
    } else if (trimmed.includes("youtube.com")) {
      const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
      const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
      const customUrlMatch = trimmed.match(/youtube\.com\/c\/([a-zA-Z0-9_.-]+)/);

      if (channelIdMatch) {
        channelId = channelIdMatch[1];
      } else if (handleMatch) {
        handle = `@${handleMatch[1]}`;
      } else if (customUrlMatch) {
        handle = `@${customUrlMatch[1]}`;
      }
    } else {
      // Assume it's a handle without @ prefix
      handle = `@${trimmed}`;
    }

    console.log("[YouTube] Looking up channel - ID:", channelId, "Handle:", handle);

    const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

    // Try by channel ID first (most reliable)
    if (channelId) {
      const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const channel = data.items[0];
          console.log("[YouTube] Found channel by ID:", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
            description: channel.snippet.description || "",
          };
        }
      }
    }

    // Try by handle (forHandle parameter)
    if (handle) {
      const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const channel = data.items[0];
          console.log("[YouTube] Found channel by handle:", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
            description: channel.snippet.description || "",
          };
        }
      }

      // Also try without the @ prefix
      const handleWithout = handle.replace(/^@/, "");
      const url2 = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handleWithout)}&key=${apiKey}`;
      const response2 = await fetch(url2);

      if (response2.ok) {
        const data2 = await response2.json();
        if (data2.items && data2.items.length > 0) {
          const channel = data2.items[0];
          console.log("[YouTube] Found channel by handle (no @):", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
            description: channel.snippet.description || "",
          };
        }
      }
    }

    console.error("[YouTube] Channel not found for input:", input);
    return null;
  } catch (error) {
    console.error("[YouTube] Error looking up channel:", error);
    return null;
  }
}

/**
 * Create placeholder followers for YouTube subscribers.
 * YouTube API does NOT provide individual subscriber lists due to privacy.
 * This creates a single aggregate record for analytics.
 */
async function createYouTubePlaceholderFollowers(
  creatorId: string,
  subscriberCount: number
): Promise<number> {
  try {
    // Delete existing YouTube follower record
    await supabase
      .from("followers")
      .delete()
      .eq("creator_id", creatorId)
      .eq("source", "youtube");

    // Create single placeholder record representing all YouTube subscribers
    const { error } = await supabase.from("followers").insert({
      creator_id: creatorId,
      source: "youtube",
      follower_youtube_count: subscriberCount,
      followed_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[YouTube] Failed to create placeholder followers:", error);
      return 0;
    }

    console.log(`[YouTube] Created placeholder for ${subscriberCount.toLocaleString()} subscribers`);
    return subscriberCount;
  } catch (error) {
    console.error("[YouTube] Error creating placeholder followers:", error);
    return 0;
  }
}

/**
 * Look up a YouTube channel without saving anything (preview only).
 */
export async function lookupYouTubeChannel(
  input: string
): Promise<YouTubeChannelInfo | null> {
  return fetchChannelByHandleOrId(input);
}

/**
 * Initiate YouTube channel verification.
 * Looks up channel, checks no other user has it verified,
 * generates a verification code, and saves it to the database.
 */
export async function initiateYouTubeVerification(
  userDID: string,
  channelInput: string
): Promise<SyncResult> {
  try {
    const channelInfo = await fetchChannelByHandleOrId(channelInput);
    if (!channelInfo) {
      return {
        success: false,
        error: "Channel not found. Please check your YouTube handle or URL and try again.",
      };
    }

    // Check if another user already has this channel verified
    const { data: existingOwner } = await supabase
      .from("creators")
      .select("did")
      .eq("youtube_channel_id", channelInfo.channelId)
      .eq("youtube_verified", true)
      .neq("did", userDID)
      .maybeSingle();

    if (existingOwner) {
      return {
        success: false,
        error: "This YouTube channel is already verified by another user.",
      };
    }

    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return { success: false, error: "Creator profile not found" };
    }

    const code = generateVerificationCode();

    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_channel_id: channelInfo.channelId,
        youtube_channel_name: channelInfo.channelName,
        youtube_subscriber_count: channelInfo.subscriberCount,
        youtube_verification_code: code,
        youtube_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      console.error("[YouTube] Failed to save verification code:", updateError);
      return { success: false, error: "Failed to save verification code" };
    }

    console.log(
      `[YouTube] Initiated verification for ${channelInfo.channelName} (code: ${code})`
    );

    return { success: true, channelInfo, verificationCode: code };
  } catch (error) {
    console.error("[YouTube] Error initiating verification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify YouTube channel ownership by checking for verification code
 * in the channel's description (About section).
 */
export async function verifyYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    const { data: creator } = await supabase
      .from("creators")
      .select("id, youtube_channel_id, youtube_verification_code")
      .eq("did", userDID)
      .single();

    if (!creator?.youtube_channel_id || !creator?.youtube_verification_code) {
      return {
        success: false,
        error: "No pending verification found. Please start the connection process first.",
      };
    }

    const channelInfo = await fetchChannelByHandleOrId(creator.youtube_channel_id);
    if (!channelInfo) {
      return {
        success: false,
        error: "Could not fetch channel data. Please try again.",
      };
    }

    if (
      !channelInfo.description ||
      !channelInfo.description.includes(creator.youtube_verification_code)
    ) {
      return {
        success: false,
        error: `Verification code not found in your channel description. Make sure "${creator.youtube_verification_code}" appears in your YouTube channel's About section, then try again. YouTube may take a few minutes to reflect description changes.`,
      };
    }

    // Verified! Mark as verified, clear the code
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_verified: true,
        youtube_verification_code: null,
        youtube_subscriber_count: channelInfo.subscriberCount,
        youtube_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      return { success: false, error: "Failed to update verification status" };
    }

    await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

    console.log(`[YouTube] Verified channel ${channelInfo.channelName}`);

    return { success: true, channelInfo };
  } catch (error) {
    console.error("[YouTube] Error verifying channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Connect YouTube channel using handle/URL entry (no OAuth required).
 * Looks up public channel data via YouTube Data API with API key.
 */
export async function syncYouTubeChannelManual(
  userDID: string,
  channelInput: string
): Promise<SyncResult> {
  try {
    const channelInfo = await fetchChannelByHandleOrId(channelInput);
    if (!channelInfo) {
      return {
        success: false,
        error: "Channel not found. Please check your YouTube handle or URL and try again.",
      };
    }

    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return { success: false, error: "Creator profile not found" };
    }

    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_channel_id: channelInfo.channelId,
        youtube_channel_name: channelInfo.channelName,
        youtube_subscriber_count: channelInfo.subscriberCount,
        youtube_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      console.error("[YouTube] Failed to update creator:", updateError);
      return { success: false, error: "Failed to save channel information" };
    }

    await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

    console.log(
      `[YouTube] Connected channel ${channelInfo.channelName} (${channelInfo.subscriberCount.toLocaleString()} subscribers)`
    );

    return { success: true, channelInfo };
  } catch (error) {
    console.error("[YouTube] Error connecting channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Re-sync YouTube channel data (refresh subscriber count).
 * Uses stored channel ID with public API key - no OAuth needed.
 */
export async function resyncYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    const { data: creator } = await supabase
      .from("creators")
      .select("id, youtube_channel_id")
      .eq("did", userDID)
      .single();

    if (!creator || !creator.youtube_channel_id) {
      return {
        success: false,
        error: "YouTube channel not connected. Please connect first.",
      };
    }

    const channelInfo = await fetchChannelByHandleOrId(creator.youtube_channel_id);
    if (!channelInfo) {
      return {
        success: false,
        error: "Failed to fetch updated channel data. Channel may have been deleted.",
      };
    }

    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_channel_name: channelInfo.channelName,
        youtube_subscriber_count: channelInfo.subscriberCount,
        youtube_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      return { success: false, error: "Failed to update channel data" };
    }

    await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

    console.log(`[YouTube] Re-synced channel ${channelInfo.channelName}`);

    return { success: true, channelInfo };
  } catch (error) {
    console.error("[YouTube] Error re-syncing channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect YouTube channel from creator profile.
 * Removes channel data and subscriber placeholder.
 */
export async function disconnectYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return { success: false, error: "Creator profile not found" };
    }

    // Delete YouTube followers
    await supabase
      .from("followers")
      .delete()
      .eq("creator_id", creator.id)
      .eq("source", "youtube");

    // Clear YouTube fields from creator
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_channel_id: null,
        youtube_channel_name: null,
        youtube_subscriber_count: 0,
        youtube_synced_at: null,
        youtube_verified: false,
        youtube_verification_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      return { success: false, error: "Failed to disconnect channel" };
    }

    console.log(`[YouTube] Disconnected YouTube channel for user ${userDID}`);

    return { success: true };
  } catch (error) {
    console.error("[YouTube] Error disconnecting channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
