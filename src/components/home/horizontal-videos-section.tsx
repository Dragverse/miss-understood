"use client";

import Link from "next/link";
import Image from "next/image";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import { FiPlay } from "react-icons/fi";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";

interface HorizontalVideosSectionProps {
  videos: Video[];
}

export function HorizontalVideosSection({ videos }: HorizontalVideosSectionProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "k";
    return num.toString();
  };

  if (videos.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <FiPlay className="text-[#EB83EA] w-5 h-5" />
          </div>
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide whitespace-nowrap font-black">
            Behind the Scenes
          </h2>
        </div>
        <div className="h-px bg-gradient-to-r from-[#2f2942] to-transparent w-full" />
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={`/watch/${video.id}`}
            className="group cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 shadow-md">
              <Image
                src={getSafeThumbnail(video.thumbnail)}
                alt={video.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded-lg">
                {formatDuration(video.duration)}
              </div>
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20">
                <Image
                  src={video.creator.avatar}
                  alt={video.creator.displayName}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-[#EB83EA] transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <span>{video.creator.displayName}</span>
                  <VerificationBadge
                    badgeType={getUserBadgeType(
                      video.creator.did,
                      undefined,
                      !!(video.creator as any).blueskyHandle,
                      !!(video.creator as any).farcasterHandle
                    )}
                    size={14}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
