"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { useSearchParams } from "next/navigation";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { Video } from "@/types";
import { ShortVideo } from "@/components/snapshots/short-video";
import { FiChevronUp, FiChevronDown, FiRefreshCw } from "react-icons/fi";
import { LoadingShimmer } from "@/components/shared";

function SnapshotsContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v");
  const [snapshots, setSnapshots] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderReady, setSliderReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load Dragverse snapshots via API (same as homepage and audio page)
  async function loadSnapshots(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch via API like other working pages (homepage, audio)
      const response = await fetch("/api/youtube/feed?includeDatabase=true&limit=100");
      const data = await response.json();

      if (!data.success || !data.videos) {
        console.warn("[Snapshots] API returned no videos");
        setSnapshots([]);
        return;
      }

      // Filter for shorts only (contentType === "short")
      const shorts = data.videos.filter((v: Video) => v.contentType === "short");

      // Sort by date (newest first)
      const sortedSnapshots = shorts.sort((a: Video, b: Video) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(`[Snapshots] Loaded ${sortedSnapshots.length} Dragverse shorts via API`);

      if (sortedSnapshots.length > 0) {
        console.log(`[Snapshots] First 3 videos:`);
        sortedSnapshots.slice(0, 3).forEach((v: Video, i: number) => {
          console.log(`  Video ${i + 1}:`, {
            id: v.id,
            title: v.title,
            playbackUrl: v.playbackUrl,
            contentType: v.contentType,
            duration: v.duration,
            thumbnail: v.thumbnail
          });
        });
      }

      setSnapshots(sortedSnapshots);
    } catch (error) {
      console.error("[Snapshots] Failed to load snapshots:", error);
      // Fallback to local videos only
      const localVideos = getLocalVideos();
      setSnapshots(localVideos.filter((v) => v.contentType === "short"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadSnapshots();
  }, []);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadSnapshots(true);
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, []);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    vertical: true,
    mode: "free-snap",
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
    if (videoId && snapshots.length > 0 && sliderReady) {
      const index = snapshots.findIndex((s) => s.id === videoId);
      if (index >= 0) {
        instanceRef.current?.moveToIdx(index);
      }
    }
  }, [videoId, snapshots, sliderReady, instanceRef]);

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
      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] bg-black p-4">
        <div className="max-w-md mx-auto h-full">
          <LoadingShimmer className="h-full" />
        </div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center bg-black">
        <div className="text-center px-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#EB83EA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-3 uppercase tracking-wide">The Spotlight Awaits</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            No snapshots on stage yet. Be the first to serve looks and performances in vertical format!
          </p>
          <div className="space-y-3">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30 text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Your First Short
            </Link>
            <p className="text-xs text-gray-500">
              Tip: Snapshots work best in 9:16 vertical format (1080x1920)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle auto-rotation to next video
  const handleVideoEnded = () => {
    if (currentSlide < snapshots.length - 1) {
      instanceRef.current?.next();
    }
  };

  return (
    <div className="relative h-[100dvh] md:h-[calc(100vh-4rem)] overflow-hidden bg-black w-full flex items-center justify-center">
      {/* Vertical Slider */}
      <div
        ref={sliderRef}
        className="keen-slider h-full w-full md:max-w-[420px]"
        style={{ touchAction: 'pan-y' }}
      >
        {snapshots.map((video, idx) => (
          <div key={video.id} className="keen-slider__slide relative">
            <ShortVideo
              video={video}
              isActive={currentSlide === idx}
              onNext={() => instanceRef.current?.next()}
              onEnded={handleVideoEnded}
            />
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
            disabled={currentSlide === snapshots.length - 1}
            className="w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FiChevronDown className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Refresh Button - Top Right */}
      <button
        onClick={() => loadSnapshots(true)}
        disabled={refreshing}
        className="fixed top-6 right-6 z-20 w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-50"
        title="Refresh snapshots"
      >
        <FiRefreshCw className={`w-6 h-6 text-white ${refreshing ? 'animate-spin' : ''}`} />
      </button>

      {/* Slide Indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {snapshots.map((_, idx) => (
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

export default function SnapshotsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] md:h-[calc(100vh-4rem)] bg-black p-4">
          <div className="max-w-md mx-auto h-full">
            <LoadingShimmer className="h-full" />
          </div>
        </div>
      }
    >
      <SnapshotsContent />
    </Suspense>
  );
}
