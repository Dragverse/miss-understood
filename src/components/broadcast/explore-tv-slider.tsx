"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { FiChevronLeft, FiChevronRight, FiPlay } from "react-icons/fi";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface ExploreTVSliderProps {
  videos: Video[];
  /** Auto-advance interval in ms. Set to 0 to disable. Default: 6000 */
  autoPlayInterval?: number;
}

export function ExploreTVSlider({ videos, autoPlayInterval = 6000 }: ExploreTVSliderProps) {
  const filteredVideos = videos.filter(
    (v) => v.contentType !== "short" && v.contentType !== "live"
  );

  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderReady, setSliderReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: true,
    slides: { perView: 1, spacing: 0 },
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
    created() {
      setSliderReady(true);
    },
  });

  // Auto-advance
  useEffect(() => {
    if (!autoPlayInterval || isPaused || filteredVideos.length <= 1) return;
    const id = setInterval(() => {
      instanceRef.current?.next();
    }, autoPlayInterval);
    return () => clearInterval(id);
  }, [autoPlayInterval, isPaused, filteredVideos.length, instanceRef]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") instanceRef.current?.prev();
      else if (e.key === "ArrowRight") instanceRef.current?.next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [instanceRef]);

  if (filteredVideos.length === 0) return null;

  const showDots = filteredVideos.length <= 12;

  return (
    <div
      className="w-full flex flex-col items-center mb-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Rabbit-ear Antennas — desktop only */}
      <div className="hidden md:flex items-end justify-center gap-10 h-14 flex-shrink-0">
        <div style={{ transform: "rotate(-25deg)", transformOrigin: "bottom center" }} className="relative">
          <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
        </div>
        <div style={{ transform: "rotate(25deg)", transformOrigin: "bottom center" }} className="relative">
          <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
        </div>
      </div>

      {/* TV Body */}
      <div className="relative w-full p-2 md:p-3 bg-gradient-to-b from-[#EB83EA] to-[#E748E6] rounded-none md:rounded-[2rem] shadow-2xl shadow-[#EB83EA]/30">

        {/* Screen */}
        <div
          ref={sliderRef}
          className="keen-slider w-full rounded-none md:rounded-[1.5rem] overflow-hidden bg-gray-950"
          style={{ aspectRatio: "16/9" }}
        >
          {filteredVideos.map((video, idx) => (
            <div key={video.id} className="keen-slider__slide relative h-full w-full">
              <Link href={`/watch/${video.id}`} className="block absolute inset-0 group">
                {/* Thumbnail */}
                <Image
                  src={getSafeThumbnail(video.thumbnail, "/default-thumbnail.jpg", video.livepeerAssetId)}
                  alt={video.title}
                  fill
                  priority={idx === 0}
                  className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/default-thumbnail.jpg"; }}
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                {/* Channel bug */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                  <span className="w-1.5 h-1.5 bg-[#EB83EA] rounded-full animate-pulse" />
                  <Image src="/logo.svg" alt="" width={12} height={12} />
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">DV TV</span>
                </div>

                {/* Slide counter */}
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                  <span className="text-white text-[10px] font-mono font-medium">
                    {String(idx + 1).padStart(2, "0")} / {String(filteredVideos.length).padStart(2, "0")}
                  </span>
                </div>

                {/* Play button (hover) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-16 h-16 rounded-full bg-[#EB83EA]/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-[#EB83EA]/40 group-hover:scale-110 transition-transform">
                    <FiPlay className="w-7 h-7 text-white ml-1" />
                  </div>
                </div>

                {/* Video info */}
                <div className="absolute bottom-4 left-4 right-24">
                  <p className="text-white font-bold text-sm md:text-base line-clamp-1 drop-shadow">
                    {video.title}
                  </p>
                  <p className="text-gray-300 text-xs mt-0.5 drop-shadow">
                    @{video.creator?.handle || video.creator?.displayName}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Nav arrows — left */}
        {sliderReady && filteredVideos.length > 1 && (
          <>
            <button
              onClick={() => instanceRef.current?.prev()}
              className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-[#EB83EA] transition-all shadow-lg"
              aria-label="Previous video"
            >
              <FiChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => instanceRef.current?.next()}
              className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-[#EB83EA] transition-all shadow-lg"
              aria-label="Next video"
            >
              <FiChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </div>

      {/* TV Stand — desktop only */}
      <div className="hidden md:flex flex-col items-center flex-shrink-0">
        <div className="w-36 h-3 bg-gradient-to-b from-[#E748E6] to-[#EB83EA] rounded-b-xl" />
        <div className="w-52 h-2 bg-[#EB83EA]/40 rounded-full mt-0.5" />
      </div>

      {/* Dot indicators */}
      {filteredVideos.length > 1 && (
        <div className="flex gap-1.5 mt-3 flex-wrap justify-center">
          {showDots ? (
            filteredVideos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => instanceRef.current?.moveToIdx(idx)}
                className={`rounded-full transition-all duration-300 ${
                  currentSlide === idx
                    ? "w-5 h-2 bg-[#EB83EA]"
                    : "w-2 h-2 bg-[#EB83EA]/30 hover:bg-[#EB83EA]/60"
                }`}
                aria-label={`Video ${idx + 1}`}
              />
            ))
          ) : (
            <span className="text-gray-500 text-xs font-mono">
              {currentSlide + 1} / {filteredVideos.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
