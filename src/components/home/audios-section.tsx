"use client";

import Link from "next/link";
import Image from "next/image";
import type { Video } from "@/types";
import { getSafeThumbnail, getSafeAvatar } from "@/lib/utils/thumbnail-helpers";
import { FiMusic, FiPlay } from "react-icons/fi";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";

interface AudiosSectionProps {
  audios: Video[];
}

export function AudiosSection({ audios }: AudiosSectionProps) {
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

  if (audios.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <FiMusic className="text-[#EB83EA] w-5 h-5" />
          </div>
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide whitespace-nowrap font-black">
            Bangers and Podcasts
          </h2>
        </div>
        <div className="h-px bg-gradient-to-r from-[#2f2942] to-transparent w-full" />
      </div>

      {/* Audio Grid - Square tiles like album covers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {audios.map((audio) => (
          <Link
            key={audio.id}
            href={`/listen/${audio.id}`}
            className="group cursor-pointer"
          >
            {/* Square Album Cover */}
            <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-lg">
              <Image
                src={getSafeThumbnail(audio.thumbnail, '/default-thumbnail.jpg', (audio as any).playbackId)}
                alt={audio.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded-lg">
                {formatDuration(audio.duration)}
              </div>

              {/* Hover play button */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <FiPlay className="w-6 h-6 text-white ml-1" />
                </div>
              </div>

              {/* Music icon indicator */}
              <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[#EB83EA]/90 backdrop-blur-sm flex items-center justify-center">
                <FiMusic className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-[#EB83EA] transition-colors">
                {audio.title}
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-[#EB83EA]/20">
                  <Image
                    src={getSafeAvatar(audio.creator.avatar, "/defaultpfp.png")}
                    alt={audio.creator.displayName}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-1 text-gray-400 text-xs min-w-0">
                  <span className="truncate">{audio.creator.displayName}</span>
                  <VerificationBadge
                    badgeType={getUserBadgeType(
                      audio.creator.did,
                      undefined,
                      !!(audio.creator as any).blueskyHandle,
                      !!(audio.creator as any).farcasterHandle
                    )}
                    size={14}
                    className="flex-shrink-0"
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
