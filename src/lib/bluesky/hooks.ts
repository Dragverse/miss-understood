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

/**
 * Hook to fetch and manage Bluesky profile data
 * Returns profile data if user has connected their Bluesky account
 */
export function useBlueskyProfile() {
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Check if connected
        const sessionResponse = await fetch("/api/bluesky/session");
        const sessionData = await sessionResponse.json();

        if (!sessionData.connected) {
          setIsConnected(false);
          setIsLoading(false);
          return;
        }

        setIsConnected(true);

        // Fetch full profile
        const profileResponse = await fetch("/api/bluesky/profile");
        const profileData = await profileResponse.json();

        if (profileData.success && profileData.profile) {
          setProfile(profileData.profile);
        }
      } catch (error) {
        console.error("Failed to fetch Bluesky profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  return {
    profile,
    isConnected,
    isLoading,
  };
}
