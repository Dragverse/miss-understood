"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiChevronLeft, FiChevronRight, FiZap, FiHeart } from "react-icons/fi";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface BytesSectionProps {
  shorts: Video[];
}

export function BytesSection({ shorts }: BytesSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  // Only show section if we have shorts
  if (shorts.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiZap className="text-[#EB83EA] w-7 h-7" />
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide">
            <span className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent font-black">
              Snapshots
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {shorts.map((video) => (
          <Link
            key={video.id}
            href={`/snapshots?v=${video.id}`}
            className="flex-shrink-0 snap-start"
          >
            <div className="relative w-[180px] aspect-[9/16] rounded-[24px] overflow-hidden group cursor-pointer shadow-xl hover:shadow-2xl transition-shadow bg-black border border-white/5">
              <Image
                src={getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', video.playbackUrl, video.livepeerAssetId)}
                alt={video.title}
                fill
                className="object-contain group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

              {/* Likes overlay - Top Left */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                <FiHeart className="w-3.5 h-3.5 text-[#EB83EA] fill-[#EB83EA]" />
                <span className="text-white text-xs font-bold">{formatNumber(video.likes)}</span>
              </div>

              {/* Title - Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-sm font-bold line-clamp-2 leading-tight">
                  {video.title}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
