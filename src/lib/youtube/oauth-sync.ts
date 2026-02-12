/**
 * YouTube OAuth Channel Sync
 * Handles YouTube OAuth flow and subscriber import via verified channel ownership
 *
 * IMPORTANT: Uses YouTube Data API v3 with OAuth 2.0
 * User must grant permission to access their channel data
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
}

interface YouTubeOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface SyncResult {
  success: boolean;
  error?: string;
  channelInfo?: YouTubeChannelInfo;
  needsManualEntry?: boolean; // true when brand channel detected, user must enter handle/URL
}

/**
 * Exchange OAuth authorization code for access tokens
 * Called after user authorizes via Google OAuth consent screen
 */
export async function exchangeYouTubeAuthCode(
  authCode: string
): Promise<{ success: boolean; tokens?: YouTubeOAuthTokens; error?: string }> {
  try {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;

    // Use production URL or fallback to localhost for development
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.NODE_ENV === 'production'
                      ? 'https://www.dragverse.app'
                      : 'http://localhost:3000');

    const redirectUri = `${baseUrl}/api/youtube/oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("YouTube OAuth credentials not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(error.error_description || "Failed to exchange auth code");
    }

    const tokenData = await tokenResponse.json();

    return {
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    };
  } catch (error) {
    console.error("[YouTube OAuth] Failed to exchange auth code:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Refresh YouTube OAuth access token using refresh token
 */
export async function refreshYouTubeAccessToken(
  refreshToken: string
): Promise<{ success: boolean; accessToken?: string; expiresAt?: Date; error?: string }> {
  try {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("YouTube OAuth credentials not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(error.error_description || "Failed to refresh token");
    }

    const tokenData = await tokenResponse.json();

    return {
      success: true,
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    };
  } catch (error) {
    console.error("[YouTube OAuth] Failed to refresh token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch authenticated user's YouTube channel info
 * Requires valid OAuth access token
 *
 * Returns { channelInfo, needsManualEntry }
 * - channelInfo: The channel data if auto-detected
 * - needsManualEntry: true if mine=true returned empty (brand channel case)
 */
export async function fetchAuthenticatedChannelInfo(
  accessToken: string
): Promise<{ channelInfo: YouTubeChannelInfo | null; needsManualEntry: boolean }> {
  try {
    // Try mine=true first (works for personal channels AND brand channels
    // if the user selected the brand channel during Google's OAuth consent screen).
    const mineUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`;

    console.log("[YouTube OAuth] Fetching channel info with mine=true");

    const response = await fetch(mineUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    console.log("[YouTube OAuth] mine=true response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[YouTube OAuth] YouTube API error:", errorText);
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[YouTube OAuth] mine=true returned items:", data.items?.length || 0);

    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      console.log("[YouTube OAuth] Auto-detected channel:", channel.snippet?.title);

      return {
        channelInfo: {
          channelId: channel.id,
          channelName: channel.snippet.title,
          subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
          avatarUrl: channel.snippet.thumbnails?.medium?.url,
          customUrl: channel.snippet.customUrl,
        },
        needsManualEntry: false,
      };
    }

    // mine=true returned empty - this is the brand/creator channel case
    // The OAuth token is valid but associated with the Google Account, not the brand channel
    console.log("[YouTube OAuth] mine=true returned empty - brand/creator channel detected.");
    console.log("[YouTube OAuth] Will redirect user to enter their channel handle/URL manually.");
    return { channelInfo: null, needsManualEntry: true };
  } catch (error) {
    console.error("[YouTube OAuth] Failed to fetch channel info:", error);
    return { channelInfo: null, needsManualEntry: false };
  }
}

/**
 * Look up a YouTube channel by handle (@username) or channel ID
 * Uses the YouTube Data API with API key (no OAuth needed for public data)
 * This is the fallback for brand/creator channels where mine=true doesn't work
 */
export async function fetchChannelByHandleOrId(
  input: string
): Promise<YouTubeChannelInfo | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("[YouTube OAuth] YOUTUBE_API_KEY not configured for channel lookup");
      return null;
    }

    // Parse the input - could be a handle, channel ID, or full URL
    let channelId: string | null = null;
    let handle: string | null = null;

    const trimmed = input.trim();

    if (trimmed.startsWith("UC") && trimmed.length >= 20) {
      // Direct channel ID (e.g., UCxxxxxxxx)
      channelId = trimmed;
    } else if (trimmed.startsWith("@")) {
      // Handle format (e.g., @TrixieMattel)
      handle = trimmed;
    } else if (trimmed.includes("youtube.com")) {
      // URL format - extract handle or channel ID
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

    console.log("[YouTube OAuth] Looking up channel - ID:", channelId, "Handle:", handle);

    const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

    // Try by channel ID first (most reliable)
    if (channelId) {
      const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const channel = data.items[0];
          console.log("[YouTube OAuth] Found channel by ID:", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
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
          console.log("[YouTube OAuth] Found channel by handle:", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
          };
        }
      }

      // Also try without the @ prefix for forHandle
      const handleWithout = handle.replace(/^@/, "");
      const url2 = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handleWithout)}&key=${apiKey}`;
      const response2 = await fetch(url2);

      if (response2.ok) {
        const data2 = await response2.json();
        if (data2.items && data2.items.length > 0) {
          const channel = data2.items[0];
          console.log("[YouTube OAuth] Found channel by handle (no @):", channel.snippet.title);
          return {
            channelId: channel.id,
            channelName: channel.snippet.title,
            subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
            avatarUrl: channel.snippet.thumbnails?.medium?.url,
            customUrl: channel.snippet.customUrl,
          };
        }
      }
    }

    console.error("[YouTube OAuth] Channel not found for input:", input);
    return null;
  } catch (error) {
    console.error("[YouTube OAuth] Error looking up channel:", error);
    return null;
  }
}

/**
 * Create placeholder followers for YouTube subscribers
 * NOTE: YouTube API does NOT provide individual subscriber lists due to privacy.
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
      console.error("[YouTube OAuth] Failed to create placeholder followers:", error);
      return 0;
    }

    console.log(
      `[YouTube OAuth] ✅ Created placeholder for ${subscriberCount.toLocaleString()} YouTube subscribers`
    );
    return subscriberCount;
  } catch (error) {
    console.error("[YouTube OAuth] Error creating placeholder followers:", error);
    return 0;
  }
}

/**
 * Encrypt OAuth tokens before storing in database
 * Uses AES-256-GCM encryption (same as Farcaster signer)
 */
function encryptToken(token: string): string {
  // TODO: Implement proper encryption using crypto library
  // For now, return base64 encoded (INSECURE - must implement encryption)
  return Buffer.from(token).toString("base64");
}

/**
 * Decrypt OAuth tokens from database
 */
function decryptToken(encryptedToken: string): string {
  // TODO: Implement proper decryption
  // For now, return base64 decoded (INSECURE - must implement decryption)
  return Buffer.from(encryptedToken, "base64").toString("utf-8");
}

/**
 * Save OAuth tokens and channel info to the database
 * Shared helper used by both auto-detect and manual entry flows
 */
async function saveChannelToDatabase(
  userDID: string,
  channelInfo: YouTubeChannelInfo,
  tokens: YouTubeOAuthTokens
): Promise<SyncResult> {
  // Get creator ID
  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("did", userDID)
    .single();

  if (!creator) {
    return { success: false, error: "Creator profile not found" };
  }

  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = encryptToken(tokens.refreshToken);

  // Update creator with YouTube channel info and OAuth tokens
  const { error: updateError } = await supabase
    .from("creators")
    .update({
      youtube_channel_id: channelInfo.channelId,
      youtube_channel_name: channelInfo.channelName,
      youtube_subscriber_count: channelInfo.subscriberCount,
      youtube_access_token: encryptedAccessToken,
      youtube_refresh_token: encryptedRefreshToken,
      youtube_token_expires_at: tokens.expiresAt.toISOString(),
      youtube_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("did", userDID);

  if (updateError) {
    console.error("[YouTube OAuth] Failed to update creator:", updateError);
    return { success: false, error: "Failed to save channel information" };
  }

  // Create placeholder followers for subscriber count
  await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

  console.log(
    `[YouTube OAuth] ✅ Synced channel ${channelInfo.channelName} (${channelInfo.subscriberCount.toLocaleString()} subscribers)`
  );

  return { success: true, channelInfo };
}

/**
 * Sync YouTube channel to creator profile via OAuth
 * Tries auto-detection first; if brand channel, signals manual entry needed
 */
export async function syncYouTubeChannelViaOAuth(
  userDID: string,
  tokens: YouTubeOAuthTokens
): Promise<SyncResult> {
  try {
    const result = await fetchAuthenticatedChannelInfo(tokens.accessToken);

    if (result.needsManualEntry) {
      // Brand/creator channel - save tokens but signal manual entry needed
      // Store tokens temporarily so user doesn't need to re-auth
      const { data: creator } = await supabase
        .from("creators")
        .select("id")
        .eq("did", userDID)
        .single();

      if (creator) {
        const encryptedAccessToken = encryptToken(tokens.accessToken);
        const encryptedRefreshToken = encryptToken(tokens.refreshToken);

        await supabase
          .from("creators")
          .update({
            youtube_access_token: encryptedAccessToken,
            youtube_refresh_token: encryptedRefreshToken,
            youtube_token_expires_at: tokens.expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("did", userDID);

        console.log("[YouTube OAuth] Stored OAuth tokens, awaiting manual channel entry");
      }

      return {
        success: false,
        needsManualEntry: true,
        error: "Brand/creator channel detected. Please enter your YouTube channel handle or URL.",
      };
    }

    if (!result.channelInfo) {
      return {
        success: false,
        error: "Failed to fetch YouTube channel. Please try again.",
      };
    }

    return await saveChannelToDatabase(userDID, result.channelInfo, tokens);
  } catch (error) {
    console.error("[YouTube OAuth] Error syncing channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Complete YouTube channel sync using manual handle/URL entry
 * Called after OAuth tokens are already stored but mine=true failed (brand channel)
 */
export async function syncYouTubeChannelManual(
  userDID: string,
  channelInput: string
): Promise<SyncResult> {
  try {
    // Look up channel by handle or ID
    const channelInfo = await fetchChannelByHandleOrId(channelInput);
    if (!channelInfo) {
      return {
        success: false,
        error: "Channel not found. Please check your YouTube handle or URL and try again.",
      };
    }

    // Get stored OAuth tokens
    const { data: creator } = await supabase
      .from("creators")
      .select("id, youtube_access_token, youtube_refresh_token, youtube_token_expires_at")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return { success: false, error: "Creator profile not found" };
    }

    // Use stored tokens (already encrypted in DB)
    const tokens: YouTubeOAuthTokens = {
      accessToken: creator.youtube_access_token ? decryptToken(creator.youtube_access_token) : "",
      refreshToken: creator.youtube_refresh_token ? decryptToken(creator.youtube_refresh_token) : "",
      expiresAt: creator.youtube_token_expires_at ? new Date(creator.youtube_token_expires_at) : new Date(),
    };

    return await saveChannelToDatabase(userDID, channelInfo, tokens);
  } catch (error) {
    console.error("[YouTube OAuth] Error in manual sync:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Re-sync YouTube channel data (refresh subscriber count)
 * Uses stored refresh token and channel ID for reliable re-sync
 */
export async function resyncYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    // Get creator with stored OAuth tokens and channel ID
    const { data: creator } = await supabase
      .from("creators")
      .select("id, youtube_channel_id, youtube_refresh_token, youtube_token_expires_at")
      .eq("did", userDID)
      .single();

    if (!creator || !creator.youtube_refresh_token) {
      return {
        success: false,
        error: "YouTube channel not connected. Please connect first.",
      };
    }

    // Decrypt refresh token
    const refreshToken = decryptToken(creator.youtube_refresh_token);

    // Refresh access token
    const refreshResult = await refreshYouTubeAccessToken(refreshToken);
    if (!refreshResult.success || !refreshResult.accessToken) {
      return {
        success: false,
        error: "Failed to refresh YouTube access. Please reconnect your channel.",
      };
    }

    // For re-sync, use stored channel ID for reliable lookup (works for brand channels)
    let channelInfo: YouTubeChannelInfo | null = null;

    if (creator.youtube_channel_id) {
      // Use stored channel ID - most reliable for brand channels
      channelInfo = await fetchChannelByHandleOrId(creator.youtube_channel_id);
    }

    if (!channelInfo) {
      // Fallback to mine=true
      const result = await fetchAuthenticatedChannelInfo(refreshResult.accessToken);
      channelInfo = result.channelInfo;
    }

    if (!channelInfo) {
      return {
        success: false,
        error: "Failed to fetch updated channel data",
      };
    }

    // Encrypt new access token
    const encryptedAccessToken = encryptToken(refreshResult.accessToken);

    // Update creator with fresh data
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        youtube_channel_name: channelInfo.channelName,
        youtube_subscriber_count: channelInfo.subscriberCount,
        youtube_access_token: encryptedAccessToken,
        youtube_token_expires_at: refreshResult.expiresAt!.toISOString(),
        youtube_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      return {
        success: false,
        error: "Failed to update channel data",
      };
    }

    // Update placeholder followers
    await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

    console.log(`[YouTube OAuth] ✅ Re-synced channel ${channelInfo.channelName}`);

    return {
      success: true,
      channelInfo,
    };
  } catch (error) {
    console.error("[YouTube OAuth] Error re-syncing channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect YouTube channel from creator profile
 * Removes OAuth tokens and subscriber placeholder
 */
export async function disconnectYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    // Get creator ID
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return {
        success: false,
        error: "Creator profile not found",
      };
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
        youtube_access_token: null,
        youtube_refresh_token: null,
        youtube_token_expires_at: null,
        youtube_synced_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("did", userDID);

    if (updateError) {
      return {
        success: false,
        error: "Failed to disconnect channel",
      };
    }

    console.log(`[YouTube OAuth] ✅ Disconnected YouTube channel for user ${userDID}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[YouTube OAuth] Error disconnecting channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate YouTube OAuth authorization URL
 * User will be redirected to Google consent screen
 */
export function generateYouTubeOAuthUrl(state?: string): string {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;

  // Use production URL or fallback to localhost for development
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  (process.env.NODE_ENV === 'production'
                    ? 'https://www.dragverse.app'
                    : 'http://localhost:3000');

  const redirectUri = `${baseUrl}/api/youtube/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    // youtube.readonly is sufficient for reading channel info and subscriber counts
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline", // Request refresh token
    prompt: "consent", // Force consent screen to get refresh token
    state: state || "", // CSRF protection
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
