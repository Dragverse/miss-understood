"use client";

import Image from "next/image";
import Link from "next/link";
import { FiCheck } from "react-icons/fi";

interface CreatorCardProps {
  handle: string;
  displayName: string;
  avatar?: string;
  verified?: boolean;
  bio?: string;
  stats?: {
    followers?: number;
    videos?: number;
  };
  variant?: "compact" | "full";
}

export function CreatorCard({
  handle,
  displayName,
  avatar,
  verified = false,
  bio,
  stats,
  variant = "compact",
}: CreatorCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Link
      href={`/profile/${handle}`}
      className="block bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/40 transition-all shadow-lg hover:shadow-xl hover:shadow-[#EB83EA]/20 hover:scale-[1.02]"
    >
      <div className={`flex ${variant === "full" ? "flex-col" : "flex-row"} items-center gap-4`}>
        {/* Avatar */}
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#EB83EA]/30 flex-shrink-0">
          {avatar ? (
            <Image src={avatar} alt={displayName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">{displayName[0]}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className={`flex-1 ${variant === "full" ? "text-center" : ""}`}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-bold text-lg">{displayName}</h3>
            {verified && (
              <div className="w-5 h-5 rounded-full bg-[#EB83EA] flex items-center justify-center">
                <FiCheck className="text-white" size={12} />
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{handle}</p>

          {/* Bio (full variant only) */}
          {variant === "full" && bio && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">{bio}</p>
          )}

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              {stats.followers !== undefined && (
                <div>
                  <span className="text-white font-bold">{formatNumber(stats.followers)}</span>
                  <span className="text-gray-400 ml-1">Followers</span>
                </div>
              )}
              {stats.videos !== undefined && (
                <div>
                  <span className="text-white font-bold">{formatNumber(stats.videos)}</span>
                  <span className="text-gray-400 ml-1">Videos</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
