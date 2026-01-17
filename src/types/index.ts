/**
 * Core type definitions for the platform
 */

// User/Creator types
export interface Creator {
  did: string; // Primary DID (Ceramic)
  handle: string;
  displayName: string;
  avatar: string;
  banner?: string; // Profile banner/cover image
  description: string;
  followerCount: number; // Aggregate count
  followingCount: number;
  dragverseFollowerCount?: number; // Followers on Dragverse (Ceramic)
  blueskyFollowerCount?: number; // Followers on Bluesky
  createdAt: Date;
  updatedAt?: Date;
  verified: boolean;
  // Social links
  twitterHandle?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  farcasterHandle?: string;
  blueskyHandle?: string; // User's Bluesky handle (if connected)
  blueskyDID?: string; // Bluesky DID (if connected)
  blueskyAppPassword?: string; // Encrypted Bluesky app password
  website?: string;
  // Monetization (for future use)
  totalEarningsUSD?: number;
  stripeAccountId?: string;
  walletAddress?: string;
}

// Content types
export type ContentType = "short" | "long" | "podcast" | "music" | "live";

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // in seconds
  views: number;
  likes: number;
  createdAt: Date;
  playbackUrl: string; // Livepeer playback URL
  livepeerAssetId: string;
  contentType: ContentType;
  creator: Creator;
  category: string;
  tags: string[];
  // External content fields (for Bluesky, etc.)
  source?: "ceramic" | "bluesky" | "farcaster";
  externalUrl?: string; // Original post URL for external content
  internalUrl?: string; // Internal Dragverse route (e.g., /profile/handle)
}

export interface Comment {
  id: string;
  content: string;
  creator: Creator;
  createdAt: Date;
  likes: number;
  replies?: Comment[];
}

// Auth types
export interface AuthSession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  creator?: Creator;
}

export interface UploadAsset {
  id: string;
  status: "uploading" | "processing" | "ready" | "failed";
  progress: number;
  playbackUrl?: string;
  error?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}
