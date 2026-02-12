import { NextRequest } from "next/server";
import { getPrivyClient } from "@/lib/privy/server";

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
      console.error("[Auth] Missing or invalid authorization header");
      return {
        authenticated: false,
        error: "Missing or invalid authorization header",
      };
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      console.error("[Auth] No token provided in authorization header");
      return {
        authenticated: false,
        error: "No token provided",
      };
    }

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!appId) {
      console.error("[Auth] NEXT_PUBLIC_PRIVY_APP_ID not configured");
      return {
        authenticated: false,
        error: "Privy not configured",
      };
    }

    console.log("[Auth] Verifying token for app:", appId);

    // Verify the access token using PrivyClient
    const privyClient = getPrivyClient();
    const verifiedClaims = await privyClient.utils().auth().verifyAccessToken(token);

    console.log("[Auth] ✓ Token verified for user:", verifiedClaims.user_id);

    return {
      authenticated: true,
      userId: verifiedClaims.user_id,
    };
  } catch (error) {
    console.error("[Auth] Verification failed:", error instanceof Error ? error.message : String(error));
    console.error("[Auth] Full error:", error);

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

/**
 * Verify authentication from cookies (for OAuth callbacks and redirects)
 * Uses Privy's cookie-based authentication instead of Bearer token
 */
export async function verifyAuthFromCookies(request: NextRequest): Promise<AuthResult> {
  try {
    // Log all cookies for debugging
    const allCookies = Array.from(request.cookies.getAll()).map(c => c.name);
    console.log("[Auth] All cookies present:", allCookies);

    const privyToken = request.cookies.get('privy-token')?.value ||
                       request.cookies.get('privy-access-token')?.value ||
                       request.cookies.get('privy-id-token')?.value;

    if (!privyToken) {
      console.error("[Auth] No Privy auth cookie found. Available cookies:", allCookies);
      return {
        authenticated: false,
        error: "No authentication cookie found",
      };
    }

    console.log("[Auth] Found Privy token in cookies");

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!appId) {
      console.error("[Auth] NEXT_PUBLIC_PRIVY_APP_ID not configured");
      return {
        authenticated: false,
        error: "Privy not configured",
      };
    }

    console.log("[Auth] Verifying cookie token for app:", appId);

    // Verify the access token using PrivyClient
    const privyClient = getPrivyClient();
    const verifiedClaims = await privyClient.utils().auth().verifyAccessToken(privyToken);

    console.log("[Auth] ✓ Cookie token verified for user:", verifiedClaims.user_id);

    return {
      authenticated: true,
      userId: verifiedClaims.user_id,
    };
  } catch (error) {
    console.error("[Auth] Cookie verification failed:", error instanceof Error ? error.message : String(error));
    console.error("[Auth] Full error:", error);

    const errorMessage = error instanceof Error ? error.message : "Invalid or expired cookie token";
    return {
      authenticated: false,
      error: `Invalid or expired token: ${errorMessage}`,
    };
  }
}
