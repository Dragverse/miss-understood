"use client";

import { useState, useEffect } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { ShortVideo } from "@/components/shorts/short-video";
import { ShortOverlayTop } from "@/components/shorts/short-overlay-top";
import { ShortOverlayBottom } from "@/components/shorts/short-overlay-bottom";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

export default function ShortsPage() {
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderReady, setSliderReady] = useState(false);

  // Load shorts from various sources
  useEffect(() => {
    async function loadShorts() {
      setLoading(true);
      const allVideos: Video[] = [];

      // Try Supabase first
      try {
        const ceramicResult = await getVideos(50);
        if (ceramicResult && ceramicResult.length > 0) {
          // Transform Supabase videos to Video type
          const transformedVideos = ceramicResult.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description || '',
            thumbnail: v.thumbnail || '',
            duration: v.duration || 0,
            views: v.views,
            likes: v.likes,
            createdAt: new Date(v.created_at),
            playbackUrl: v.playback_url || '',
            livepeerAssetId: v.livepeer_asset_id || '',
            contentType: v.content_type as any || 'short',
            creator: {} as any,
            category: v.category || '',
            tags: v.tags || [],
            source: 'ceramic' as const,
          }));
          allVideos.push(...transformedVideos as Video[]);
        }
      } catch (error) {
        console.warn("Supabase unavailable");
      }

      // Fetch from Bluesky
      try {
        const blueskyResponse = await fetch("/api/bluesky/feed?limit=30");
        if (blueskyResponse.ok) {
          const blueskyData = await blueskyResponse.json();
          if (blueskyData.posts) {
            allVideos.push(...blueskyData.posts);
          }
        }
      } catch (error) {
        console.warn("Bluesky unavailable");
      }

      // Fetch from YouTube
      try {
        const youtubeResponse = await fetch("/api/youtube/feed?limit=30");
        if (youtubeResponse.ok) {
          const youtubeData = await youtubeResponse.json();
          if (youtubeData.success && youtubeData.videos) {
            allVideos.push(...youtubeData.videos);
          }
        }
      } catch (error) {
        console.warn("YouTube unavailable");
      }

      // Add local uploads
      const localVideos = getLocalVideos();
      allVideos.push(...localVideos);

      // Filter only shorts
      const shortsOnly = allVideos.filter((v) => v.contentType === "short");

      // Sort by date (newest first)
      shortsOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setShorts(shortsOnly);
      setLoading(false);
    }

    loadShorts();
  }, []);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: 0,
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instanceRef]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">No shorts available yet</p>
          <p className="text-gray-500 text-sm">
            Upload a short video or check back for content from Bluesky
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-black">
      {/* Vertical Slider */}
      <div
        ref={sliderRef}
        className="keen-slider h-full snap-y snap-mandatory overflow-y-hidden"
      >
        {shorts.map((video, idx) => (
          <div key={video.id} className="keen-slider__slide relative">
            <ShortVideo video={video} isActive={currentSlide === idx} />
            <ShortOverlayTop video={video} />
            <ShortOverlayBottom video={video} />
          </div>
        ))}
      </div>

      {/* Navigation Buttons - Desktop Only */}
      {sliderReady && (
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
            disabled={currentSlide === shorts.length - 1}
            className="w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FiChevronDown className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Slide Indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {shorts.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all ${
              currentSlide === idx
                ? "w-8 bg-[#EB83EA]"
                : "w-1 bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
