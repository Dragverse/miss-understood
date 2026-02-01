import { useMemo } from "react";
import { useAuthUser } from "@/lib/privy/hooks";
import { getUserBadgeType, getBadgeName } from "./permissions";
import type { BadgeType } from "./permissions";

/**
 * Hook to get the current user's verification badge
 */
export function useVerificationBadge() {
  const { userId, userEmail, blueskyConnected, farcasterHandle } = useAuthUser();

  const badgeType = useMemo(() => {
    return getUserBadgeType(
      userId,
      userEmail,
      blueskyConnected,
      !!farcasterHandle
    );
  }, [userId, userEmail, blueskyConnected, farcasterHandle]);

  const badgeName = useMemo(() => {
    return getBadgeName(badgeType);
  }, [badgeType]);

  return {
    badgeType,
    badgeName,
    hasBadge: badgeType !== null,
  };
}

/**
 * Get badge type for any user (not just current user)
 */
export function getCreatorBadgeType(
  userId?: string,
  userEmail?: string,
  hasBluesky?: boolean,
  hasFarcaster?: boolean
): BadgeType {
  return getUserBadgeType(userId, userEmail, hasBluesky, hasFarcaster);
}
