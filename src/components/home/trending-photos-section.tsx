"use client";

import { useRef } from "react";
import Image from "next/image";
import { FiChevronLeft, FiChevronRight, FiImage, FiHeart, FiMessageCircle, FiExternalLink } from "react-icons/fi";

interface PhotoPost {
  id: string;
  thumbnail: string;
  description: string;
  creator: {
    displayName: string;
    handle: string;
    avatar: string;
  };
  likes: number;
  replyCount?: number;
  externalUrl: string;
  createdAt: Date | string;
}

export function TrendingPhotosSection({ photos }: { photos: PhotoPost[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320;
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

  if (photos.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header with scroll controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiImage className="text-[#EB83EA] w-8 h-8" />
          <h2 className="font-bold text-2xl lg:text-3xl uppercase tracking-widest">
            Trending Photos
          </h2>
        </div>
        <div className="flex gap-3">
          <button onClick={() => scroll("left")} className="w-11 h-11 rounded-full border border-[#2f2942] flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white">
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => scroll("right")} className="w-11 h-11 rounded-full border border-[#2f2942] flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white">
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {photos.map((photo) => (
          <a key={photo.id} href={photo.externalUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 snap-start group">
            <div className="relative w-[280px] aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-lg">
              <Image src={photo.thumbnail} alt={photo.description} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Creator info & engagement */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Image src={photo.creator.avatar} alt={photo.creator.displayName} width={32} height={32} className="rounded-full border-2 border-white/20" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{photo.creator.displayName}</p>
                    <p className="text-gray-300 text-xs truncate">@{photo.creator.handle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-white text-xs">
                  <div className="flex items-center gap-1.5">
                    <FiHeart className="w-4 h-4 text-red-400" />
                    <span className="font-bold">{formatNumber(photo.likes)}</span>
                  </div>
                  {photo.replyCount !== undefined && photo.replyCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FiMessageCircle className="w-4 h-4 text-blue-400" />
                      <span className="font-bold">{formatNumber(photo.replyCount)}</span>
                    </div>
                  )}
                  <div className="ml-auto">
                    <FiExternalLink className="w-4 h-4 opacity-60" />
                  </div>
                </div>

                {photo.description && (
                  <p className="text-white/90 text-xs mt-2 line-clamp-2 leading-relaxed">{photo.description}</p>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
