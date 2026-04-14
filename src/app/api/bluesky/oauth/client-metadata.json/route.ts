import { NextResponse } from "next/server";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

/**
 * GET /api/bluesky/oauth/client-metadata.json
 * Serves the OAuth client metadata document for AT Protocol OAuth
 */
export async function GET() {
  const appUrl = getAppUrl();

  const metadata = {
    client_id: `${appUrl}/api/bluesky/oauth/client-metadata.json`,
    client_name: "Dragverse",
    client_uri: appUrl,
    logo_uri: `${appUrl}/icon.png`,
    tos_uri: `${appUrl}/terms`,
    policy_uri: `${appUrl}/privacy`,
    redirect_uris: [`${appUrl}/api/bluesky/oauth/callback`],
    grant_types: ["authorization_code", "refresh_token"],
    scope: "atproto transition:generic transition:chat.bsky",
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: `${appUrl}/api/bluesky/oauth/jwks.json`,
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
