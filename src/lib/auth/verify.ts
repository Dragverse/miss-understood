import { verifyAccessToken } from "@privy-io/node";
import { createRemoteJWKSet } from "jose";
import { NextRequest } from "next/server";

// Cache the JWKS for performance
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwksCache) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!appId) {
      throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");
    }
    // Privy's JWKS endpoint
    const jwksUrl = `https://auth.privy.io/api/v1/apps/${appId}/.well-known/jwks.json`;

    try {
      jwksCache = createRemoteJWKSet(new URL(jwksUrl));
    } catch (error) {
      console.error("[Auth] Failed to create JWKS fetcher:", error);
      throw error;
    }
  }
  return jwksCache;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify authentication from request headers
 * Extracts the Privy auth token from Authorization header and verifies it
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        authenticated: false,
        error: "Missing or invalid authorization header",
      };
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return {
        authenticated: false,
        error: "No token provided",
      };
    }

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!appId) {
      return {
        authenticated: false,
        error: "Privy not configured",
      };
    }

    // Verify the access token with Privy
    const verifiedClaims = await verifyAccessToken({
      access_token: token,
      app_id: appId,
      verification_key: getJWKS(),
    });

    return {
      authenticated: true,
      userId: verifiedClaims.user_id,
    };
  } catch (error) {
    console.error("[Auth] Verification failed:", error instanceof Error ? error.message : String(error));

    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : "Invalid or expired token";
    return {
      authenticated: false,
      error: `Invalid or expired token: ${errorMessage}`,
    };
  }
}

/**
 * Helper to check if Privy is configured
 */
export function isPrivyConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
}
