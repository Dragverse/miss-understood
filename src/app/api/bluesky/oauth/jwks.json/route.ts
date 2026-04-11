import { NextResponse } from "next/server";

/**
 * GET /api/bluesky/oauth/jwks.json
 * Serves the public key(s) for verifying OAuth client assertions
 */
export async function GET() {
  const privateKeyJwk = JSON.parse(process.env.BLUESKY_OAUTH_PRIVATE_KEY!);

  // Extract public key only (remove private component 'd')
  const { d: _d, ...publicKeyJwk } = privateKeyJwk;

  const jwks = {
    keys: [
      {
        ...publicKeyJwk,
        use: "sig",
        alg: "ES256",
      },
    ],
  };

  return NextResponse.json(jwks, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
