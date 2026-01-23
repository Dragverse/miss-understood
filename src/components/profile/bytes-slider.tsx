"use client";

import { useState, useEffect } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { ShortVideo } from "@/components/shorts/short-video";
import { ShortOverlayTop } from "@/components/shorts/short-overlay-top";
import { ShortOverlayBottom } from "@/components/shorts/short-overlay-bottom";
import { FiX, FiChevronUp, FiChevronDown } from "react-icons/fi";
import type { Video } from "@/types";

interface BytesSliderProps {
  bytesList: Video[];
  onClose: () => void;
  initialIndex?: number;
}

export function BytesSlider({ bytesList, onClose, initialIndex = 0 }: BytesSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(initialIndex);
  const [sliderReady, setSliderReady] = useState(false);

  // Keen Slider for vertical video player
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: initialIndex,
    vertical: true,
    slides: {
      perView: 1,
      spacing: 0,
    },
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
      if (e.key === "ArrowUp") {
        e.preventDefault();
        instanceRef.current?.prev();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        instanceRef.current?.next();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instanceRef, onClose]);

  if (bytesList.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition"
        >
          <FiX className="w-6 h-6 text-white" />
        </button>
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">No Bytes Yet</h3>
          <p className="text-gray-400">Upload some short videos to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition"
      >
        <FiX className="w-6 h-6 text-white" />
      </button>

      {/* Vertical Slider */}
      <div
        ref={sliderRef}
        className="keen-slider h-full snap-y snap-mandatory overflow-y-hidden"
      >
        {bytesList.map((video, idx) => (
          <div key={video.id} className="keen-slider__slide relative">
            <ShortVideo
              video={video}
              isActive={currentSlide === idx}
              onNext={() => instanceRef.current?.next()}
            />
            <ShortOverlayTop video={video} />
            <ShortOverlayBottom video={video} />
          </div>
        ))}
      </div>

      {/* Navigation Buttons - Desktop */}
      {sliderReady && bytesList.length > 1 && (
        <div className="hidden md:flex flex-col gap-4 fixed right-8 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => instanceRef.current?.prev()}
            disabled={currentSlide === 0}
            className="w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FiChevronUp className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => instanceRef.current?.next()}
            disabled={currentSlide === bytesList.length - 1}
            className="w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FiChevronDown className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Slide Indicator */}
      {bytesList.length > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20">
          {bytesList.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${
                currentSlide === idx ? "w-8 bg-[#EB83EA]" : "w-1 bg-gray-600"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
