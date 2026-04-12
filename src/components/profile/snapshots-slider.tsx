"use client";

import { useState, useEffect } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { ShortVideo } from "@/components/snapshots/short-video";
import { FiX, FiChevronUp, FiChevronDown } from "react-icons/fi";
import type { Video } from "@/types";

interface SnapshotsSliderProps {
  snapshotsList: Video[];
  onClose: () => void;
  initialIndex?: number;
}

export function SnapshotsSlider({ snapshotsList, onClose, initialIndex = 0 }: SnapshotsSliderProps) {
  // Filter out live streams — they don't belong in the short-video slider
  const filteredList = snapshotsList.filter((v) => v.contentType !== "live");

  // Clamp initial index in case the first item was filtered out
  const safeInitial = Math.min(initialIndex, Math.max(0, filteredList.length - 1));

  const [currentSlide, setCurrentSlide] = useState(safeInitial);
  const [sliderReady, setSliderReady] = useState(false);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: safeInitial,
    vertical: true,
    slides: { perView: 1, spacing: 0 },
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
    created() {
      setSliderReady(true);
    },
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); instanceRef.current?.prev(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); instanceRef.current?.next(); }
      else if (e.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instanceRef, onClose]);

  if (filteredList.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button onClick={onClose} className="fixed top-4 right-4 z-50 w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition">
          <FiX className="w-6 h-6 text-white" />
        </button>
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">No Snapshots Yet</h3>
          <p className="text-gray-400">Upload some short videos to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition"
        aria-label="Close"
      >
        <FiX className="w-5 h-5 text-white" />
      </button>

      {/* Pink TV frame + slider */}
      <div className="relative flex flex-col items-center w-full h-full md:h-[90vh] md:max-w-[380px]">

        {/* Rabbit-ear Antenna — desktop only */}
        <div className="hidden md:flex items-end justify-center gap-0 mb-0 relative h-14 flex-shrink-0">
          <div className="relative" style={{ transform: "rotate(-25deg)", transformOrigin: "bottom center" }}>
            <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
          </div>
          <div className="relative" style={{ transform: "rotate(25deg)", transformOrigin: "bottom center" }}>
            <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
          </div>
        </div>

        {/* TV Body */}
        <div className="relative flex-1 w-full min-h-0 p-1.5 md:p-2 bg-gradient-to-b from-[#EB83EA] to-[#E748E6] rounded-none md:rounded-[2rem] shadow-2xl shadow-[#EB83EA]/30">
          {/* Screen — keen-slider lives here */}
          <div
            ref={sliderRef}
            className="keen-slider h-full w-full rounded-none md:rounded-[1.5rem] overflow-hidden bg-gray-950"
          >
            {filteredList.map((video, idx) => (
              <div key={video.id} className="keen-slider__slide relative">
                <ShortVideo
                  video={video}
                  isActive={currentSlide === idx}
                  onNext={() => instanceRef.current?.next()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* TV Stand — desktop only */}
        <div className="hidden md:flex items-center justify-center flex-shrink-0">
          <div className="w-20 h-3 bg-gradient-to-b from-[#E748E6] to-[#EB83EA] rounded-b-lg" />
        </div>
      </div>

      {/* Navigation arrows — desktop, beside the TV */}
      {sliderReady && filteredList.length > 1 && (
        <div className="hidden md:flex flex-col gap-3 fixed right-8 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => instanceRef.current?.prev()}
            disabled={currentSlide === 0}
            className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30"
            aria-label="Previous"
          >
            <FiChevronUp className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => instanceRef.current?.next()}
            disabled={currentSlide === filteredList.length - 1}
            className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30"
            aria-label="Next"
          >
            <FiChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Slide counter */}
      {filteredList.length > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
          <span className="text-white text-sm font-medium tabular-nums">
            {currentSlide + 1} / {filteredList.length}
          </span>
        </div>
      )}
    </div>
  );
}
