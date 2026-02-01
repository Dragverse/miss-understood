import Image from "next/image";
import type { BadgeType } from "@/lib/verification";
import { getBadgeName } from "@/lib/verification";

interface VerificationBadgeProps {
  badgeType: BadgeType;
  className?: string;
  size?: number;
}

/**
 * Verification Badge Component
 * Shows golden, pink, or purple badge based on user verification tier
 */
export function VerificationBadge({
  badgeType,
  className = "",
  size = 20
}: VerificationBadgeProps) {
  if (!badgeType) return null;

  const badgeName = getBadgeName(badgeType);
  const badgePath = `/` + badgeType + `-badge.svg`;

  return (
    <Image
      src={badgePath}
      alt={badgeName}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      title={badgeName}
    />
  );
}
