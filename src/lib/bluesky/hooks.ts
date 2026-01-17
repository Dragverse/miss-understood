import { useState, useEffect } from "react";

export interface BlueskyProfile {
  handle: string;
  displayName: string;
  avatar: string | null;
  banner: string | null;
  description: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  did: string;
}

// Global cache to avoid duplicate fetches across components
let cachedProfile: BlueskyProfile | null = null;
let cachedIsConnected = false;
let cacheTimestamp: number | null = null;
let fetchPromise: Promise<void> | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch and manage Bluesky profile data
 * Returns profile data if user has connected their Bluesky account
 * Uses global caching to avoid redundant API calls
 */
export function useBlueskyProfile() {
  const [profile, setProfile] = useState<BlueskyProfile | null>(cachedProfile);
  const [isConnected, setIsConnected] = useState(cachedIsConnected);
  const [isLoading, setIsLoading] = useState(!cacheTimestamp);

  useEffect(() => {
    async function fetchProfile() {
      // Check if cache is still valid
      if (cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        setProfile(cachedProfile);
        setIsConnected(cachedIsConnected);
        setIsLoading(false);
        return;
      }

      // If already fetching, wait for that promise
      if (fetchPromise) {
        await fetchPromise;
        setProfile(cachedProfile);
        setIsConnected(cachedIsConnected);
        setIsLoading(false);
        return;
      }

      // Create new fetch promise
      fetchPromise = (async () => {
        try {
          // Fetch profile directly (which internally checks session)
          const profileResponse = await fetch("/api/bluesky/profile");
          const profileData = await profileResponse.json();

          if (profileData.success && profileData.profile) {
            cachedProfile = profileData.profile;
            cachedIsConnected = true;
            cacheTimestamp = Date.now();
          } else {
            cachedProfile = null;
            cachedIsConnected = false;
            cacheTimestamp = Date.now();
          }
        } catch (error) {
          console.error("Failed to fetch Bluesky profile:", error);
          cachedProfile = null;
          cachedIsConnected = false;
          cacheTimestamp = Date.now();
        }
      })();

      await fetchPromise;
      fetchPromise = null;

      setProfile(cachedProfile);
      setIsConnected(cachedIsConnected);
      setIsLoading(false);
    }

    fetchProfile();
  }, []);

  return {
    profile,
    isConnected,
    isLoading,
  };
}

/**
 * Clear the Bluesky profile cache
 * Useful when user disconnects or updates their profile
 */
export function clearBlueskyCache() {
  cachedProfile = null;
  cachedIsConnected = false;
  cacheTimestamp = null;
  fetchPromise = null;
}

/**
 * Hook to fetch any public Bluesky profile by handle
 * Use this to display external Bluesky accounts on Dragverse
 *
 * @param handle - Bluesky handle (e.g., "rupaulsdragrace.bsky.social")
 * @returns Profile data, loading state
 */
export function useBlueskyProfileByHandle(handle: string | null) {
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setProfile(null);
      setError(null);
      return;
    }

    async function fetchProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/bluesky/profile/${encodeURIComponent(handle)}`);
        const data = await response.json();

        if (data.success && data.profile) {
          setProfile(data.profile);
        } else {
          setError(data.error || "Failed to fetch profile");
          setProfile(null);
        }
      } catch (err) {
        console.error("Failed to fetch Bluesky profile:", err);
        setError("Network error");
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [handle]);

  return {
    profile,
    isLoading,
    error,
  };
}
