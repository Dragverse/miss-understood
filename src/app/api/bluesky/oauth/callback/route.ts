import { NextRequest, NextResponse } from "next/server";
import {
  getOAuthClient,
  linkBlueskyOAuthDID,
} from "@/lib/bluesky/oauth-client";
import { Agent } from "@atproto/api";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

/**
 * GET /api/bluesky/oauth/callback
 * Handles the OAuth callback from Bluesky after user authorization.
 * Links the Bluesky account to the Privy user and redirects to settings.
 */
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();

  try {
    const client = await getOAuthClient();

    // Extract callback params from URL
    const params = new URLSearchParams(request.nextUrl.search);

    const { session, state } = await client.callback(params);

    // state contains the Privy user DID (set in /login)
    const privyDID = state;

    if (!privyDID) {
      console.error("[Bluesky OAuth] No state (Privy DID) in callback");
      return NextResponse.redirect(
        `${appUrl}/settings?bluesky=error&message=Missing+state`
      );
    }

    // Get the user's Bluesky handle via the authenticated agent
    const agent = new Agent(session);
    const profile = await agent.getProfile({ actor: session.did });
    const blueskyHandle = profile.data.handle;

    console.log(
      `[Bluesky OAuth] Successfully authenticated: @${blueskyHandle} (${session.did})`
    );

    // Link the Bluesky DID to the Privy user in the database
    await linkBlueskyOAuthDID(privyDID, session.did, blueskyHandle);

    return NextResponse.redirect(
      `${appUrl}/settings?bluesky=connected&handle=${encodeURIComponent(blueskyHandle)}`
    );
  } catch (error) {
    console.error("[Bluesky OAuth] Callback error:", error);

    const message =
      error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(
      `${appUrl}/settings?bluesky=error&message=${encodeURIComponent(message)}`
    );
  }
}
