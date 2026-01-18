/**
 * Video Access Control Middleware
 * Validates whether a user can access a video based on privacy settings
 */

import { getSupabaseServerClient } from "@/lib/supabase/client";

export interface VideoAccessResult {
  allowed: boolean;
  reason?: string;
  video?: {
    id: string;
    title: string;
    visibility: "public" | "unlisted" | "private";
    creator_did: string;
    playback_url: string;
    [key: string]: any;
  };
}

export interface AccessLogData {
  video_id: string;
  viewer_ip?: string;
  viewer_did?: string;
  access_method: "direct" | "share_token" | "embed";
  share_token_id?: string;
  user_agent?: string;
  referer?: string;
}

/**
 * Validates if a user can access a video
 * @param videoId - The video UUID
 * @param userId - The authenticated user's DID (optional)
 * @param shareToken - Share token for private/unlisted access (optional)
 * @returns Access result with allowed status and optional reason
 */
export async function validateVideoAccess(
  videoId: string,
  userId?: string,
  shareToken?: string
): Promise<VideoAccessResult> {
  const supabase = getSupabaseServerClient();

  try {
    // Fetch video with visibility
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return {
        allowed: false,
        reason: "Video not found",
      };
    }

    const visibility = video.visibility || "public";

    // PUBLIC: Anyone can access
    if (visibility === "public") {
      return {
        allowed: true,
        video,
      };
    }

    // UNLISTED: Anyone with the link can access
    // But also check share token if provided
    if (visibility === "unlisted") {
      // If share token provided, validate it
      if (shareToken) {
        const tokenValidation = await validateShareToken(
          shareToken,
          videoId,
          supabase
        );
        if (!tokenValidation.valid) {
          return {
            allowed: false,
            reason: tokenValidation.reason || "Invalid share token",
          };
        }
      }

      return {
        allowed: true,
        video,
      };
    }

    // PRIVATE: Only creator or valid share token can access
    if (visibility === "private") {
      // Check if user is the creator
      if (userId && userId === video.creator_did) {
        return {
          allowed: true,
          video,
        };
      }

      // Check if valid share token provided
      if (shareToken) {
        const tokenValidation = await validateShareToken(
          shareToken,
          videoId,
          supabase
        );
        if (tokenValidation.valid) {
          return {
            allowed: true,
            video,
          };
        }
        return {
          allowed: false,
          reason: tokenValidation.reason || "Invalid share token",
        };
      }

      // No valid credentials
      return {
        allowed: false,
        reason: userId
          ? "You don't have permission to view this video"
          : "This video is private. Please sign in or use a valid share link.",
      };
    }

    // Unknown visibility setting
    return {
      allowed: false,
      reason: "Invalid video privacy setting",
    };
  } catch (error) {
    console.error("Error validating video access:", error);
    return {
      allowed: false,
      reason: "An error occurred while checking video access",
    };
  }
}

/**
 * Validates a share token
 * @param token - The share token string
 * @param videoId - The video UUID
 * @param supabase - Supabase client
 * @returns Validation result
 */
async function validateShareToken(
  token: string,
  videoId: string,
  supabase: any
): Promise<{ valid: boolean; reason?: string; tokenId?: string }> {
  try {
    const { data: shareToken, error } = await supabase
      .from("video_share_tokens")
      .select("*")
      .eq("token", token)
      .eq("video_id", videoId)
      .single();

    if (error || !shareToken) {
      return { valid: false, reason: "Invalid share token" };
    }

    // Check if revoked
    if (shareToken.revoked) {
      return { valid: false, reason: "This share link has been revoked" };
    }

    // Check if expired
    if (shareToken.expires_at) {
      const expiresAt = new Date(shareToken.expires_at);
      if (expiresAt < new Date()) {
        return { valid: false, reason: "This share link has expired" };
      }
    }

    // Check max views
    if (
      shareToken.max_views &&
      shareToken.view_count >= shareToken.max_views
    ) {
      return {
        valid: false,
        reason: "This share link has reached its view limit",
      };
    }

    // Valid token - increment view count
    await supabase
      .from("video_share_tokens")
      .update({ view_count: shareToken.view_count + 1 })
      .eq("id", shareToken.id);

    return { valid: true, tokenId: shareToken.id };
  } catch (error) {
    console.error("Error validating share token:", error);
    return { valid: false, reason: "Error validating share token" };
  }
}

/**
 * Logs video access for analytics and security
 * @param logData - Access log data
 */
export async function logVideoAccess(logData: AccessLogData): Promise<void> {
  const supabase = getSupabaseServerClient();

  try {
    await supabase.from("video_access_logs").insert({
      video_id: logData.video_id,
      viewer_ip: logData.viewer_ip,
      viewer_did: logData.viewer_did,
      access_method: logData.access_method,
      share_token_id: logData.share_token_id,
      user_agent: logData.user_agent,
      referer: logData.referer,
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error("Error logging video access:", error);
  }
}

/**
 * Gets client IP from request headers (works with Vercel)
 * @param headers - Request headers
 * @returns Client IP address
 */
export function getClientIP(headers: Headers): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",")[0] ||
    headers.get("x-real-ip") ||
    undefined
  );
}
