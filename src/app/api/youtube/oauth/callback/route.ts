import { NextRequest, NextResponse } from "next/server";
import {
  exchangeYouTubeAuthCode,
  syncYouTubeChannelViaOAuth,
} from "@/lib/youtube/oauth-sync";

/**
 * GET /api/youtube/oauth/callback
 * OAuth callback handler for YouTube channel connection
 *
 * Query params:
 * - code: OAuth authorization code
 * - state: CSRF token (optional)
 * - error: Error from OAuth provider (if authorization denied)
 */
export async function GET(request: NextRequest) {
  // Use production URL or fallback to localhost for development
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  (process.env.NODE_ENV === 'production'
                    ? 'https://www.dragverse.app'
                    : 'http://localhost:3000');

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    // Handle OAuth errors (user denied permission)
    if (error) {
      console.log(`[YouTube OAuth] User denied permission: ${error}`);
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=denied`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=no_code`
      );
    }

    // Extract user ID from state parameter
    // Format: {csrfToken}:{userDID}
    if (!state || !state.includes(':')) {
      console.error("[YouTube OAuth] Invalid or missing state parameter");
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=invalid_state`
      );
    }

    const [csrfToken, userDID] = state.split(':');
    if (!userDID) {
      console.error("[YouTube OAuth] No user ID in state parameter");
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=no_user_id`
      );
    }

    console.log(`[YouTube OAuth] Processing callback for user: ${userDID}`);

    // Exchange authorization code for OAuth tokens
    const tokenResult = await exchangeYouTubeAuthCode(code);
    if (!tokenResult.success || !tokenResult.tokens) {
      console.error("[YouTube OAuth] Token exchange failed:", tokenResult.error);
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=token_exchange_failed`
      );
    }

    // Sync YouTube channel with creator profile
    const syncResult = await syncYouTubeChannelViaOAuth(userDID, tokenResult.tokens);
    if (!syncResult.success) {
      const errorDetail = syncResult.error || "sync_failed";
      console.error("[YouTube OAuth] Channel sync failed:", errorDetail);
      console.error("[YouTube OAuth] Full sync result:", JSON.stringify(syncResult));

      // Include detailed error in URL for debugging
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=${encodeURIComponent(errorDetail)}&debug=true`
      );
    }

    // Success! Redirect to settings with success message
    console.log(
      `[YouTube OAuth] ✅ Successfully connected channel: ${syncResult.channelInfo?.channelName}`
    );
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_success=true&channel=${encodeURIComponent(syncResult.channelInfo?.channelName || "")}&subscribers=${syncResult.channelInfo?.subscriberCount || 0}`
    );
  } catch (error) {
    console.error("[YouTube OAuth] Callback error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=unknown`
    );
  }
}
