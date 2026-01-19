"use client";

import { useState, useEffect, Suspense } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { useSearchParams } from "next/navigation";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { ShortVideo } from "@/components/shorts/short-video";
import { ShortOverlayTop } from "@/components/shorts/short-overlay-top";
import { ShortOverlayBottom } from "@/components/shorts/short-overlay-bottom";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

function ShortsContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v");
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderReady, setSliderReady] = useState(false);

  // Load shorts from various sources
  useEffect(() => {
    async function loadShorts() {
      setLoading(true);

      try {
        console.log("[Shorts] Fetching from all sources in parallel...");

        // Fetch from ALL sources in parallel (faster!)
        const [supabaseVideos, blueskyVideos, youtubeVideos] = await Promise.all([
          // Supabase/Dragverse videos
          getVideos(50).catch((err) => {
            console.warn("[Shorts] Supabase fetch failed:", err);
            return [];
          }),
          // Bluesky videos
          fetch("/api/bluesky/feed?limit=30")
            .then((res) => (res.ok ? res.json() : { posts: [] }))
            .then((data) => data.posts || [])
            .catch((err) => {
              console.warn("[Shorts] Bluesky fetch failed:", err);
              return [];
            }),
          // YouTube videos
          fetch("/api/youtube/feed?limit=30")
            .then((res) => (res.ok ? res.json() : { videos: [] }))
            .then((data) => data.videos || [])
            .catch((err) => {
              console.warn("[Shorts] YouTube fetch failed:", err);
              return [];
            }),
        ]);

        // Transform Supabase videos to Video type
        const transformedSupabase = (supabaseVideos || []).map((v) => ({
          id: v.id,
          title: v.title,
          description: v.description || "",
          thumbnail: v.thumbnail || "",
          duration: v.duration || 0,
          views: v.views,
          likes: v.likes,
          createdAt: new Date(v.created_at),
          playbackUrl: v.playback_url || "",
          livepeerAssetId: v.livepeer_asset_id || "",
          contentType: (v.content_type as any) || "short",
          creator: {
            did: v.creator_did || "unknown",
            handle: v.creator_did?.split(":").pop()?.substring(0, 8) || "creator",
            displayName: "Dragverse Creator",
            avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${v.creator_did}&backgroundColor=EB83EA`,
            description: "",
            followerCount: 0,
            followingCount: 0,
            createdAt: new Date(v.created_at),
            verified: false,
          } as any,
          category: v.category || "",
          tags: v.tags || [],
          source: "ceramic" as const,
        })) as Video[];

        // Combine all sources
        const allVideos = [
          ...transformedSupabase,
          ...(blueskyVideos || []),
          ...(youtubeVideos || []),
          ...getLocalVideos(),
        ];

        console.log(`[Shorts] Loaded ${transformedSupabase.length} Supabase, ${blueskyVideos?.length || 0} Bluesky, ${youtubeVideos?.length || 0} YouTube videos`);

        // Debug: Log all video contentTypes
        console.log("[Shorts] All videos with contentType:", allVideos.map(v => ({
          id: v.id.substring(0, 8),
          title: v.title,
          contentType: v.contentType,
          source: v.source
        })));

        // Filter only shorts (include all sources: Dragverse, YouTube, Bluesky)
        // Focus on drag-specific content
        // Also filter out videos without valid playback URLs
        const shortsOnly = allVideos.filter((v) =>
          v.contentType === "short" &&
          v.playbackUrl &&
          v.playbackUrl.trim() !== ''
        );

        // Sort by date (newest first)
        shortsOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        console.log(`[Shorts] Displaying ${shortsOnly.length} shorts after filtering (with valid playback URLs)`);
        console.log("[Shorts] Filtered shorts:", shortsOnly.map(v => ({
          id: v.id.substring(0, 8),
          title: v.title,
          playbackUrl: v.playbackUrl ? "✅" : "❌"
        })));
        setShorts(shortsOnly);
      } catch (error) {
        console.error("[Shorts] Failed to load shorts:", error);
        // Fallback to local videos only
        const localVideos = getLocalVideos();
        setShorts(localVideos.filter((v) => v.contentType === "short"));
      } finally {
        setLoading(false);
      }
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

  // Jump to specific video if ?v=videoId query param is present
  useEffect(() => {
    if (videoId && shorts.length > 0 && sliderReady) {
      const index = shorts.findIndex((s) => s.id === videoId);
      if (index >= 0) {
        console.log(`[Shorts] Jumping to video ${videoId} at index ${index}`);
        instanceRef.current?.moveToIdx(index);
      } else {
        console.warn(`[Shorts] Video ${videoId} not found in shorts list`);
      }
    }
  }, [videoId, shorts, sliderReady, instanceRef]);

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
      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">No shorts available yet</p>
          <p className="text-gray-500 text-sm">
            Upload a short video or check back for content from Bluesky
          </p>
        </div>
      </div>
    );
  }

  // Handle auto-rotation to next video
  const handleVideoEnded = () => {
    if (currentSlide < shorts.length - 1) {
      instanceRef.current?.next();
    }
  };

  return (
    <div className="relative h-[100dvh] md:h-[calc(100vh-4rem)] overflow-hidden bg-black">
      {/* Vertical Slider */}
      <div
        ref={sliderRef}
        className="keen-slider h-full snap-y snap-mandatory overflow-y-hidden"
      >
        {shorts.map((video, idx) => (
          <div key={video.id} className="keen-slider__slide relative">
            <ShortVideo
              video={video}
              isActive={currentSlide === idx}
              onNext={() => instanceRef.current?.next()}
              onEnded={handleVideoEnded}
            />
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

export default function ShortsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      }
    >
      <ShortsContent />
    </Suspense>
  );
}
