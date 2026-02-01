/**
 * Verification badge system
 * Controls which users get which verification badges
 *
 * Badge Tiers:
 * - GOLDEN: Dragverse team and selected accounts (highest tier)
 * - PINK: Verified creators we specifically select
 * - PURPLE: Users with connected social accounts (Bluesky/Farcaster)
 */

// Golden badge - Team and selected accounts
const GOLDEN_BADGE_USERS: string[] = [
  // Founder/Team
  "privy:cmkgjgjd003ezla0cf5dweu37", // Salti (founder)
];

// Pink badge - Verified creators
const PINK_BADGE_USERS: string[] = [
  // Add verified creator IDs here
];

// Environment variable overrides
const ENV_GOLDEN = process.env.NEXT_PUBLIC_GOLDEN_BADGE_USERS?.split(",").map(s => s.trim()).filter(Boolean) || [];
const ENV_PINK = process.env.NEXT_PUBLIC_PINK_BADGE_USERS?.split(",").map(s => s.trim()).filter(Boolean) || [];

export type BadgeType = "golden" | "pink" | "purple" | null;

/**
 * Get the verification badge type for a user
 * Checks in order: Golden -> Pink -> Purple -> None
 */
export function getUserBadgeType(
  userId?: string,
  userEmail?: string,
  hasBluesky?: boolean,
  hasFarcaster?: boolean
): BadgeType {
  if (!userId && !userEmail) return null;

  // Check Golden (highest tier)
  const goldenList = [...GOLDEN_BADGE_USERS, ...ENV_GOLDEN];
  if (userId && goldenList.includes(userId)) return "golden";
  if (userEmail && goldenList.includes(userEmail.toLowerCase())) return "golden";

  // Check Pink (mid tier)
  const pinkList = [...PINK_BADGE_USERS, ...ENV_PINK];
  if (userId && pinkList.includes(userId)) return "pink";
  if (userEmail && pinkList.includes(userEmail.toLowerCase())) return "pink";

  // Check Purple (social connections)
  if (hasBluesky || hasFarcaster) return "purple";

  return null;
}

/**
 * Get badge display name
 */
export function getBadgeName(badgeType: BadgeType): string {
  switch (badgeType) {
    case "golden":
      return "Dragverse Team";
    case "pink":
      return "Verified Creator";
    case "purple":
      return "Connected Creator";
    default:
      return "";
  }
}

/**
 * Check if user has golden or pink badge (premium verification)
 * Used for determining livestream access and other premium features
 */
export function hasPremiumBadge(
  userId?: string,
  userEmail?: string
): boolean {
  if (!userId && !userEmail) return false;

  const goldenList = [...GOLDEN_BADGE_USERS, ...ENV_GOLDEN];
  const pinkList = [...PINK_BADGE_USERS, ...ENV_PINK];

  if (userId && (goldenList.includes(userId) || pinkList.includes(userId))) return true;
  if (userEmail && (goldenList.includes(userEmail.toLowerCase()) || pinkList.includes(userEmail.toLowerCase()))) return true;

  return false;
}

/**
 * Get all users with golden or pink badges (for livestream allowlist)
 */
export function getPremiumBadgeUsers(): string[] {
  const goldenList = [...GOLDEN_BADGE_USERS, ...ENV_GOLDEN];
  const pinkList = [...PINK_BADGE_USERS, ...ENV_PINK];
  return [...goldenList, ...pinkList];
}
