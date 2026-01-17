import { BskyAgent } from "@atproto/api";
import { BlueskySessionData } from "./config";

const BLUESKY_SERVICE = "https://bsky.social";

/**
 * Error types for Bluesky validation
 */
export type BlueskyErrorType =
  | "INVALID_HANDLE"
  | "INVALID_PASSWORD"
  | "NETWORK_ERROR"
  | "SERVICE_ERROR";

export interface BlueskyValidationResult {
  success: boolean;
  data?: BlueskySessionData;
  error?: string;
  errorType?: BlueskyErrorType;
}

/**
 * Normalize and validate Bluesky handle format
 * Auto-adds .bsky.social if missing
 */
export function validateHandleFormat(handle: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const trimmed = handle.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: "Handle is required" };
  }

  // Check for invalid characters
  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Handle can only contain letters, numbers, dots, and hyphens",
    };
  }

  // Auto-add .bsky.social if no domain provided
  let normalized = trimmed;
  if (!normalized.includes(".")) {
    normalized = `${normalized}.bsky.social`;
  } else if (!normalized.endsWith(".bsky.social") && !normalized.includes(".")) {
    // If they provided something like "user.custom" leave it
    // But if just "user", add .bsky.social
  }

  return { valid: true, normalized };
}

/**
 * Validate Bluesky credentials by attempting login
 * Returns session data if successful, error details if not
 */
export async function validateBlueskyCredentials(
  handle: string,
  appPassword: string
): Promise<BlueskyValidationResult> {
  // First validate handle format
  const handleValidation = validateHandleFormat(handle);
  if (!handleValidation.valid) {
    return {
      success: false,
      error: handleValidation.error,
      errorType: "INVALID_HANDLE",
    };
  }

  const normalizedHandle = handleValidation.normalized!;

  // Validate app password format (should be xxxx-xxxx-xxxx-xxxx)
  if (!appPassword || appPassword.trim().length < 4) {
    return {
      success: false,
      error: "App password is required",
      errorType: "INVALID_PASSWORD",
    };
  }

  // Attempt login to validate credentials
  const agent = new BskyAgent({ service: BLUESKY_SERVICE });

  try {
    const response = await agent.login({
      identifier: normalizedHandle,
      password: appPassword.trim(),
    });

    // Login successful - return session data
    // Note: avatar is not included in login response, can be fetched separately if needed
    return {
      success: true,
      data: {
        handle: normalizedHandle,
        appPassword: appPassword.trim(),
        did: response.data.did,
        displayName: response.data.handle,
        connectedAt: Date.now(),
      },
    };
  } catch (error: any) {
    console.error("Bluesky validation error:", error);

    // Determine error type
    if (error.message?.includes("Invalid identifier or password")) {
      return {
        success: false,
        error: "Invalid handle or app password",
        errorType: "INVALID_PASSWORD",
      };
    }

    if (error.message?.includes("AuthenticationRequired")) {
      return {
        success: false,
        error: "Invalid credentials. Please check your handle and app password.",
        errorType: "INVALID_PASSWORD",
      };
    }

    if (
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.message?.includes("fetch")
    ) {
      return {
        success: false,
        error: "Network error. Please check your connection and try again.",
        errorType: "NETWORK_ERROR",
      };
    }

    // Generic service error
    return {
      success: false,
      error: "Unable to connect to Bluesky. Please try again later.",
      errorType: "SERVICE_ERROR",
    };
  }
}

/**
 * Get authenticated Bluesky agent from session data
 * Returns agent if successful, error if session expired/invalid
 */
export async function getAuthenticatedAgent(
  sessionData: BlueskySessionData
): Promise<{ agent?: BskyAgent; error?: string }> {
  if (!sessionData.handle || !sessionData.appPassword) {
    return { error: "Invalid session data" };
  }

  const agent = new BskyAgent({ service: BLUESKY_SERVICE });

  try {
    await agent.login({
      identifier: sessionData.handle,
      password: sessionData.appPassword,
    });

    return { agent };
  } catch (error: any) {
    console.error("Session authentication error:", error);

    if (
      error.message?.includes("Invalid") ||
      error.message?.includes("AuthenticationRequired")
    ) {
      return { error: "Your session has expired. Please reconnect your account." };
    }

    return { error: "Authentication failed. Please try reconnecting your account." };
  }
}
