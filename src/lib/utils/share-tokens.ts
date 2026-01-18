/**
 * Share Token Utilities
 * Generate and manage share tokens for video sharing
 */

import { getSupabaseServerClient } from "@/lib/supabase/client";
import { randomBytes } from "crypto";

export interface ShareTokenOptions {
  expiresIn?: number; // seconds from now
  maxViews?: number; // maximum number of views
}

export interface ShareToken {
  id: string;
  token: string;
  video_id: string;
  created_by: string;
  expires_at?: string;
  max_views?: number;
  view_count: number;
  revoked: boolean;
  created_at: string;
}

/**
 * Generates a cryptographically secure share token
 * @param videoId - The video UUID
 * @param creatorDid - The creator's DID
 * @param options - Token options (expiration, max views)
 * @returns The generated token string and full share URL
 */
export async function createShareToken(
  videoId: string,
  creatorDid: string,
  options: ShareTokenOptions = {}
): Promise<{ token: string; shareUrl: string; tokenData: ShareToken }> {
  const supabase = getSupabaseServerClient();

  // Generate secure random token (32 bytes = 64 hex chars)
  const tokenBuffer = randomBytes(32);
  const token = tokenBuffer.toString("hex");

  // Calculate expiration timestamp
  let expiresAt: string | undefined;
  if (options.expiresIn) {
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + options.expiresIn);
    expiresAt = expirationDate.toISOString();
  }

  // Insert token into database
  const { data, error } = await supabase
    .from("video_share_tokens")
    .insert({
      video_id: videoId,
      token,
      created_by: creatorDid,
      expires_at: expiresAt,
      max_views: options.maxViews,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating share token:", error);
    throw new Error("Failed to create share token");
  }

  // Generate share URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";
  const shareUrl = `${baseUrl}/watch/${videoId}?token=${token}`;

  return {
    token,
    shareUrl,
    tokenData: data,
  };
}

/**
 * Revokes a share token
 * @param tokenId - The token UUID
 * @param userId - The user requesting revocation (must be creator)
 * @returns Success status
 */
export async function revokeShareToken(
  tokenId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  // Verify user owns the token
  const { data: token, error: fetchError } = await supabase
    .from("video_share_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (fetchError || !token) {
    return { success: false, error: "Token not found" };
  }

  if (token.created_by !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Revoke the token
  const { error: updateError } = await supabase
    .from("video_share_tokens")
    .update({ revoked: true })
    .eq("id", tokenId);

  if (updateError) {
    console.error("Error revoking token:", updateError);
    return { success: false, error: "Failed to revoke token" };
  }

  return { success: true };
}

/**
 * Gets all share tokens for a video
 * @param videoId - The video UUID
 * @param creatorDid - The creator's DID
 * @returns Array of share tokens
 */
export async function getShareTokens(
  videoId: string,
  creatorDid: string
): Promise<ShareToken[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("video_share_tokens")
    .select("*")
    .eq("video_id", videoId)
    .eq("created_by", creatorDid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching share tokens:", error);
    return [];
  }

  return data || [];
}

/**
 * Deletes expired tokens (cleanup function)
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("video_share_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("Error cleaning up expired tokens:", error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Formats token expiration for display
 * @param expiresAt - ISO timestamp
 * @returns Human-readable expiration string
 */
export function formatTokenExpiration(expiresAt?: string): string {
  if (!expiresAt) return "Never";

  const expiration = new Date(expiresAt);
  const now = new Date();
  const diff = expiration.getTime() - now.getTime();

  if (diff < 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return "Less than 1 hour";
}
