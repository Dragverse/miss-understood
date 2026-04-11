"use client";

import Image from "next/image";
import Link from "next/link";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";

interface CreatorInfoProps {
  avatar?: string | null;
  displayName: string;
  handle: string;
  did?: string;
  verified?: boolean;
  date?: string | Date;
  compact?: boolean;
  linkToProfile?: boolean;
  className?: string;
}

function formatTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function CreatorInfo({
  avatar,
  displayName,
  handle,
  did,
  verified,
  date,
  compact = false,
  linkToProfile = true,
  className = "",
}: CreatorInfoProps) {
  const badgeType = getUserBadgeType(did, undefined, verified);
  const safeSrc = avatar && avatar.trim() !== "" ? avatar : "/defaultpfp.png";

  const avatarSize = compact ? "w-8 h-8" : "w-10 h-10";
  const nameSize = compact ? "text-sm" : "text-base";
  const handleSize = compact ? "text-xs" : "text-sm";

  const content = (
    <div className={`flex items-center gap-3 group ${className}`}>
      <div
        className={`relative ${avatarSize} rounded-full overflow-hidden border-2 border-[#EB83EA]/30 group-hover:border-[#EB83EA] transition-all flex-shrink-0`}
      >
        <Image
          src={safeSrc}
          alt={displayName}
          fill
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={`${nameSize} font-bold text-white group-hover:text-[#EB83EA] transition-colors truncate`}
          >
            {displayName || "Unknown"}
          </p>
          {badgeType && <VerificationBadge badgeType={badgeType} size={14} />}
        </div>
        {!compact && (
          <p className={`${handleSize} text-gray-400 truncate`}>
            @{handle || did?.slice(0, 8) || "unknown"}
            {date && <> • {formatTimeAgo(date)}</>}
          </p>
        )}
      </div>
    </div>
  );

  if (linkToProfile) {
    return (
      <Link href={`/profile/${handle || did}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
