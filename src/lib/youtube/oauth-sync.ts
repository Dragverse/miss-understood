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
 */
export async function fetchAuthenticatedChannelInfo(
  accessToken: string
): Promise<YouTubeChannelInfo | null> {
  try {
    // Fetch user's own channel (using "mine=true")
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`;

    console.log("[YouTube OAuth] Fetching channel info with access token");
    console.log("[YouTube OAuth] Request URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    console.log("[YouTube OAuth] YouTube API response status:", response.status);
    console.log("[YouTube OAuth] Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[YouTube OAuth] YouTube API error response:", errorText);
      let errorMessage = `YouTube API error: ${response.status}`;
      try {
        const error = JSON.parse(errorText);
        console.error("[YouTube OAuth] Parsed error:", error);
        errorMessage = error.error?.message || errorMessage;
        // Include error details for debugging
        if (error.error?.errors) {
          console.error("[YouTube OAuth] Error details:", error.error.errors);
        }
      } catch (e) {
        console.error("[YouTube OAuth] Could not parse error response as JSON");
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("[YouTube OAuth] YouTube API response data:", JSON.stringify(data, null, 2));
    console.log("[YouTube OAuth] Number of items returned:", data.items?.length || 0);
    console.log("[YouTube OAuth] Page info:", data.pageInfo);

    const channel = data.items?.[0];

    if (!channel) {
      console.error("[YouTube OAuth] No channel found in response.");
      console.error("[YouTube OAuth] Full response:", data);
      console.error("[YouTube OAuth] This account may not have a YouTube channel created yet.");
      throw new Error("No YouTube channel found for this account. Please create a channel first at youtube.com");
    }

    const channelInfo = {
      channelId: channel.id,
      channelName: channel.snippet.title,
      subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
      avatarUrl: channel.snippet.thumbnails?.medium?.url,
      customUrl: channel.snippet.customUrl,
    };

    console.log("[YouTube OAuth] ✅ Successfully fetched channel:", channelInfo.channelName);

    return channelInfo;
  } catch (error) {
    console.error("[YouTube OAuth] Failed to fetch channel info:", error);
    console.error("[YouTube OAuth] Error details:", error instanceof Error ? error.message : String(error));
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
 * Sync YouTube channel to creator profile via OAuth
 * Verifies channel ownership and imports subscriber count
 */
export async function syncYouTubeChannelViaOAuth(
  userDID: string,
  tokens: YouTubeOAuthTokens
): Promise<SyncResult> {
  try {
    // Fetch authenticated channel info
    const channelInfo = await fetchAuthenticatedChannelInfo(tokens.accessToken);
    if (!channelInfo) {
      return {
        success: false,
        error: "Failed to fetch YouTube channel. Ensure you have a YouTube channel.",
      };
    }

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
      return {
        success: false,
        error: "Failed to save channel information",
      };
    }

    // Create placeholder followers for subscriber count
    await createYouTubePlaceholderFollowers(creator.id, channelInfo.subscriberCount);

    console.log(
      `[YouTube OAuth] ✅ Synced channel ${channelInfo.channelName} (${channelInfo.subscriberCount.toLocaleString()} subscribers)`
    );

    return {
      success: true,
      channelInfo,
    };
  } catch (error) {
    console.error("[YouTube OAuth] Error syncing channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Re-sync YouTube channel data (refresh subscriber count)
 * Uses stored refresh token to get new access token
 */
export async function resyncYouTubeChannel(userDID: string): Promise<SyncResult> {
  try {
    // Get creator with stored OAuth tokens
    const { data: creator } = await supabase
      .from("creators")
      .select("id, youtube_refresh_token, youtube_token_expires_at")
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

    // Fetch updated channel info
    const channelInfo = await fetchAuthenticatedChannelInfo(refreshResult.accessToken);
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
    scope: "https://www.googleapis.com/auth/youtube.readonly", // Read-only access (no verification required)
    access_type: "offline", // Request refresh token
    prompt: "consent", // Force consent screen to get refresh token
    state: state || "", // CSRF protection
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
