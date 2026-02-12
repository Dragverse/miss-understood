import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
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

    // Verify user authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.redirect(
        `${baseUrl}/login?redirect=/settings`
      );
    }

    // Exchange authorization code for OAuth tokens
    const tokenResult = await exchangeYouTubeAuthCode(code);
    if (!tokenResult.success || !tokenResult.tokens) {
      console.error("[YouTube OAuth] Token exchange failed:", tokenResult.error);
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=token_exchange_failed`
      );
    }

    // Sync YouTube channel with creator profile
    const syncResult = await syncYouTubeChannelViaOAuth(auth.userId, tokenResult.tokens);
    if (!syncResult.success) {
      console.error("[YouTube OAuth] Channel sync failed:", syncResult.error);
      return NextResponse.redirect(
        `${baseUrl}/settings?youtube_error=${encodeURIComponent(syncResult.error || "sync_failed")}`
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
