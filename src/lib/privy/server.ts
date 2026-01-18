/**
 * Privy server-side utilities
 * Fetch user profiles from Privy's server API
 */

import { PrivyClient } from "@privy-io/node";

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("Privy not configured. Set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET");
    }

    privyClient = new PrivyClient(appId, appSecret);
  }

  return privyClient;
}

/**
 * Fetch full user profile from Privy server API
 * Returns user with all linked accounts (Twitter, Google, Farcaster, etc.)
 */
export async function getPrivyUserProfile(userId: string) {
  try {
    const client = getPrivyClient();
    const user = await client.getUser(userId);
    return user;
  } catch (error) {
    console.error("[Privy] Failed to fetch user profile:", error);
    return null;
  }
}

/**
 * Extract best display name from Privy user profile
 * Priority: Twitter name > Google name > Farcaster name > Email username
 */
export function extractDisplayName(user: any): string {
  // Twitter profile name
  if (user.twitter?.name) {
    return user.twitter.name;
  }

  // Google profile name
  if (user.google?.name) {
    return user.google.name;
  }

  // Farcaster display name
  if (user.farcaster?.displayName) {
    return user.farcaster.displayName;
  }

  // Discord username
  if (user.discord?.username) {
    return user.discord.username;
  }

  // GitHub username
  if (user.github?.username) {
    return user.github.username;
  }

  // Email username
  if (user.email?.address) {
    return user.email.address.split("@")[0];
  }

  // Google email username
  if (user.google?.email) {
    return user.google.email.split("@")[0];
  }

  return "Dragverse User";
}

/**
 * Extract best handle from Privy user profile
 * Priority: Twitter > Farcaster > TikTok > Instagram > Email
 */
export function extractHandle(user: any, userId: string): string {
  // Twitter handle (without @)
  if (user.twitter?.username) {
    return user.twitter.username;
  }

  // Farcaster username
  if (user.farcaster?.username) {
    return user.farcaster.username;
  }

  // TikTok username
  if (user.tiktok?.username) {
    return user.tiktok.username;
  }

  // Instagram username
  if (user.instagram?.username) {
    return user.instagram.username;
  }

  // Discord username
  if (user.discord?.username) {
    return user.discord.username;
  }

  // GitHub username
  if (user.github?.username) {
    return user.github.username;
  }

  // Google email username
  if (user.google?.email) {
    return user.google.email.split("@")[0];
  }

  // Email username
  if (user.email?.address) {
    return user.email.address.split("@")[0];
  }

  // Fallback to shortened DID
  return `user-${userId.substring(0, 8)}`;
}

/**
 * Extract avatar from Privy user profile
 * Priority: Twitter > Google > Discord > GitHub > Generated
 */
export function extractAvatar(user: any, userId: string): string {
  // Twitter profile picture
  if (user.twitter?.profilePictureUrl) {
    return user.twitter.profilePictureUrl;
  }

  // Google profile picture
  if (user.google?.picture) {
    return user.google.picture;
  }

  // Discord avatar
  if (user.discord?.avatar) {
    return user.discord.avatar;
  }

  // GitHub avatar
  if (user.github?.avatarUrl) {
    return user.github.avatarUrl;
  }

  // Farcaster pfp
  if (user.farcaster?.pfp) {
    return user.farcaster.pfp;
  }

  // Generate avatar from DID
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}`;
}

/**
 * Extract all social handles from Privy user profile
 */
export function extractSocialHandles(user: any) {
  return {
    twitter_handle: user.twitter?.username || "",
    instagram_handle: user.instagram?.username || "",
    tiktok_handle: user.tiktok?.username || "",
    farcaster_handle: user.farcaster?.username || "",
    bluesky_handle: "", // Bluesky is handled separately via our own integration
    bluesky_did: "",
  };
}
