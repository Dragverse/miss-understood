import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/lib/store/auth";
import { useCeramic } from "@/lib/ceramic/ceramic-provider";
import { useBlueskyProfile } from "@/lib/bluesky/hooks";

/**
 * Combined hook that provides both Privy auth and our store
 * No crypto language exposed - just clean auth state
 */
export function useAuthUser() {
  const { authenticated, user, login, logout, ready } = usePrivy();
  const { session, creator } = useAuth();
  const {
    ceramicDID,
    isAuthenticated: isCeramicAuthenticated,
    isAuthenticating: isCeramicAuthenticating,
    authenticateCeramic
  } = useCeramic();
  const { profile: blueskyProfile, isConnected: blueskyConnected } = useBlueskyProfile();

  return {
    // User info
    isAuthenticated: authenticated,
    user: user,
    session,
    creator,

    // Auth actions (no crypto terminology)
    signIn: login,
    signOut: logout,

    // Loading state
    isReady: ready,

    // Derived values
    userEmail: user?.email?.address,
    userHandle: user?.farcaster?.username || user?.google?.email || user?.email?.address || "user",
    userId: user?.id,

    // Ceramic state
    ceramicDID,
    isCeramicAuthenticated,
    isCeramicAuthenticating,
    authenticateCeramic,

    // Social handles from Privy
    instagramHandle: user?.instagram?.username,
    tiktokHandle: user?.tiktok?.username,
    farcasterHandle: user?.farcaster?.username,

    // Bluesky profile
    blueskyProfile,
    blueskyConnected,
  };
}
