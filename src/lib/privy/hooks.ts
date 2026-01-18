import { usePrivy, useWallets, useLinkAccount } from "@privy-io/react-auth";
import { useAuth } from "@/lib/store/auth";
import { useBlueskyProfile } from "@/lib/bluesky/hooks";

/**
 * Combined hook that provides both Privy auth and our store
 * No crypto language exposed - just clean auth state
 */
export function useAuthUser() {
  const {
    authenticated,
    user,
    login,
    logout,
    ready,
    unlinkWallet,
    unlinkEmail,
    unlinkGoogle,
  } = usePrivy();
  const { wallets } = useWallets();
  const { linkWallet, linkEmail, linkGoogle } = useLinkAccount();
  const { session, creator } = useAuth();
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
    userHandle: blueskyProfile?.handle || user?.twitter?.username || user?.farcaster?.username || user?.google?.email?.split('@')[0] || user?.email?.address?.split('@')[0] || "user",
    userId: user?.id,

    // Social handles from Privy
    instagramHandle: user?.instagram?.username,
    tiktokHandle: user?.tiktok?.username,
    farcasterHandle: user?.farcaster?.username,

    // Bluesky profile
    blueskyProfile,
    blueskyConnected,

    // Wallet management
    wallets,
    linkedAccounts: user?.linkedAccounts || [],
    emailAccount: user?.email,
    googleAccount: user?.google,

    // Link/unlink actions
    linkWallet,
    linkEmail,
    linkGoogle,
    unlinkWallet,
    unlinkEmail,
    unlinkGoogle,
  };
}
