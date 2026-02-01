/**
 * Privy server-side utilities
 * Fetch user profiles from Privy's server API
 */

import { PrivyClient } from "@privy-io/node";

let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("Privy not configured. Set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET");
    }

    privyClient = new PrivyClient({
      appId,
      appSecret,
    });
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
    const user = await client.users()._get(userId);
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

  // Email username - capitalize and format nicely
  if (user.email?.address) {
    const emailName = user.email.address.split("@")[0];
    // Capitalize and clean up email username (e.g., "john.doe" -> "John Doe")
    return emailName
      .split(/[._-]/)
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  // Google email username - capitalize and format nicely
  if (user.google?.email) {
    const emailName = user.google.email.split("@")[0];
    return emailName
      .split(/[._-]/)
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  // Wallet-based fallback
  if (user.wallet?.address) {
    return `Artist ${user.wallet.address.substring(0, 6)}`;
  }

  // Last resort - more friendly than "Dragverse User"
  return "Drag Artist";
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

  // Google email username - clean for handle format
  if (user.google?.email) {
    const emailUsername = user.google.email.split("@")[0];
    return emailUsername.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Email username - clean for handle format
  if (user.email?.address) {
    const emailUsername = user.email.address.split("@")[0];
    return emailUsername.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Wallet-based fallback
  if (user.wallet?.address) {
    return `artist-${user.wallet.address.substring(2, 10).toLowerCase()}`;
  }

  // Last resort: make it more user-friendly
  const shortId = userId.includes("did:privy:")
    ? userId.replace("did:privy:", "").substring(0, 8)
    : userId.substring(0, 8);

  return `user-${shortId}`;
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

  // Use default profile picture
  return "/defaultpfp.png";
}

/**
 * Extract all social handles from Privy user profile
 */
export function extractSocialHandles(user: any) {
  // Extract Farcaster FID from linked accounts
  const farcasterAccount = user.linked_accounts?.find(
    (account: any) => account.type === "farcaster"
  );

  return {
    twitter_handle: user.twitter?.username || "",
    instagram_handle: user.instagram?.username || "",
    tiktok_handle: user.tiktok?.username || "",
    farcaster_handle: user.farcaster?.username || "",
    farcaster_fid: farcasterAccount?.fid || null,
    // Bluesky is handled separately via our own integration (see extractBlueskyFromSession)
  };
}

/**
 * Extract Bluesky profile data from user session
 * Returns null if no Bluesky connection found
 */
export async function extractBlueskyFromSession(request: any): Promise<{
  handle: string;
  displayName?: string;
  avatar?: string;
  did?: string;
} | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getIronSession } = await import("iron-session");
    const { sessionOptions } = await import("@/lib/session/config");
    type SessionData = import("@/lib/session/config").SessionData;

    const response = {
      headers: new Headers(),
      // Provide minimal Response interface for iron-session compatibility
      ok: true,
      redirected: false,
      status: 200,
      statusText: "OK",
      type: "default" as ResponseType,
      url: "",
      clone: () => response as any,
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    } as Response;
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.bluesky) {
      return null;
    }

    return {
      handle: session.bluesky.handle,
      displayName: session.bluesky.displayName,
      avatar: session.bluesky.avatar,
      did: session.bluesky.did,
    };
  } catch (error) {
    console.error("[extractBlueskyFromSession] Error:", error);
    return null;
  }
}
