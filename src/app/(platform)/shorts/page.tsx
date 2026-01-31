"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { useSearchParams } from "next/navigation";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { ShortVideo } from "@/components/shorts/short-video";
import { FiChevronUp, FiChevronDown, FiRefreshCw } from "react-icons/fi";
import { isValidPlaybackUrl } from "@/lib/utils/thumbnail-helpers";
import { calculateQualityScore } from "@/lib/curation/quality-score";

function ShortsContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v");
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderReady, setSliderReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Deduplicate shorts by ID
  const deduplicateShorts = (videos: Video[]) => {
    const seen = new Set<string>();
    return videos.filter(video => {
      const id = video.id || video.externalUrl || `${video.source}-${video.title}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  // Apply quality filtering and prioritization
  const filterAndSortShorts = (dragverseShorts: Video[], externalShorts: Video[]) => {
    // Calculate quality scores
    const dragverseWithScores = dragverseShorts.map(video => ({
      ...video,
      qualityScore: calculateQualityScore(video).overallScore,
    }));

    const externalWithScores = externalShorts.map(video => ({
      ...video,
      qualityScore: calculateQualityScore(video).overallScore,
    }));

    // Filter by quality thresholds
    const filteredDragverse = dragverseWithScores.filter(v => v.qualityScore >= 30);
    const filteredExternal = externalWithScores.filter(v => v.qualityScore >= 40);

    // Diagnostic logging
    console.log(`[Shorts Quality] Dragverse: ${dragverseShorts.length} → ${filteredDragverse.length} (threshold: 30)`);
    console.log(`[Shorts Quality] External: ${externalShorts.length} → ${filteredExternal.length} (threshold: 40)`);
    if (dragverseWithScores.length > 0) {
      console.log(`[Shorts Quality] Sample Dragverse scores:`, dragverseWithScores.slice(0, 3).map(v => ({
        title: v.title?.substring(0, 30),
        score: v.qualityScore,
        source: v.source,
      })));
    }
    if (externalWithScores.length > 0) {
      console.log(`[Shorts Quality] Sample external scores:`, externalWithScores.slice(0, 3).map(v => ({
        title: v.title?.substring(0, 30),
        score: v.qualityScore,
        source: v.source,
      })));
    }

    // Sort each group by quality score (descending)
    const sortedDragverse = filteredDragverse.sort((a, b) => b.qualityScore - a.qualityScore);
    const sortedExternal = filteredExternal.sort((a, b) => b.qualityScore - a.qualityScore);

    // Strong Dragverse priority: show all Dragverse first
    return [...sortedDragverse, ...sortedExternal];
  };

  // Load shorts from various sources
  async function loadShorts(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch from ALL sources in parallel (faster!)
      const [supabaseVideos, blueskyVideos, youtubeVideos] = await Promise.all([
        // Supabase/Dragverse videos
        getVideos(50).catch(() => []),
        // Bluesky videos (only posts with actual video embeds - may be sparse)
        fetch("/api/bluesky/feed?limit=30")
          .then((res) => (res.ok ? res.json() : { posts: [] }))
          .then((data) => data.posts || [])
          .catch(() => []),
        // YouTube Shorts (via RSS from curated drag channels)
        fetch("/api/youtube/feed?limit=30&shortsOnly=true&rssOnly=true")
          .then((res) => (res.ok ? res.json() : { videos: [] }))
          .then((data) => data.videos || [])
          .catch(() => []),
      ]);

      // Transform Supabase videos to Video type
      const transformedSupabase = (supabaseVideos || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        description: v.description || "",
        thumbnail: v.thumbnail || "/default-thumbnail.jpg",
        duration: v.duration || 0,
        views: v.views,
        likes: v.likes,
        createdAt: new Date(v.created_at),
        playbackUrl: v.playback_url || "",
        livepeerAssetId: v.livepeer_asset_id || "",
        contentType: (v.content_type as any) || "short",
        creator: v.creator ? {
          did: v.creator.did,
          handle: v.creator.handle,
          displayName: v.creator.display_name,
          avatar: v.creator.avatar || "/defaultpfp.png",
          description: "",
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date(v.created_at),
          verified: v.creator.verified || false,
        } : {
          did: v.creator_did || "unknown",
          handle: v.creator_did?.split(":").pop()?.substring(0, 8) || "creator",
          displayName: "Dragverse Creator",
          avatar: "/defaultpfp.png",
          description: "",
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date(v.created_at),
          verified: false,
        },
        category: v.category || "",
        tags: v.tags || [],
        source: "ceramic" as const,
      })) as Video[];

      // Separate shorts by source
      const dragverseShorts = transformedSupabase.filter((v) => {
        const isShortDuration = v.duration > 0 && v.duration < 60;
        const isShortType = v.contentType === "short";
        const hasValidUrl = isValidPlaybackUrl(v.playbackUrl);
        return hasValidUrl && (isShortType || isShortDuration);
      });

      const externalShorts = [
        ...(blueskyVideos || []),
        ...(youtubeVideos || []),
        ...getLocalVideos(),
      ].filter((v) => {
        const isShortDuration = v.duration > 0 && v.duration < 60;
        const isShortType = v.contentType === "short";
        const hasValidUrl = isValidPlaybackUrl(v.playbackUrl);
        return hasValidUrl && (isShortType || isShortDuration);
      });

      // Deduplicate and apply quality filtering
      const dedupedDragverse = deduplicateShorts(dragverseShorts);
      const dedupedExternal = deduplicateShorts(externalShorts);
      const sortedShorts = filterAndSortShorts(dedupedDragverse, dedupedExternal);

      setShorts(sortedShorts);
    } catch (error) {
      console.error("[Shorts] Failed to load shorts:", error);
      // Fallback to local videos only
      const localVideos = getLocalVideos();
      setShorts(localVideos.filter((v) => v.contentType === "short"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadShorts();
  }, []);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadShorts(true);
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
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
        instanceRef.current?.moveToIdx(index);
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
      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center bg-black">
        <div className="text-center px-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#EB83EA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">No Shorts Available</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Be the first to share your drag artistry! Upload your performances, tutorials, makeup transformations, or behind-the-scenes moments in vertical video format.
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
              Tip: Shorts work best in 9:16 vertical format (1080x1920)
            </p>
          </div>
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

      {/* Refresh Button - Top Right */}
      <button
        onClick={() => loadShorts(true)}
        disabled={refreshing}
        className="fixed top-6 right-6 z-20 w-12 h-12 bg-gray-800/80 rounded-full flex items-center justify-center hover:bg-gray-700/80 transition disabled:opacity-50"
        title="Refresh shorts"
      >
        <FiRefreshCw className={`w-6 h-6 text-white ${refreshing ? 'animate-spin' : ''}`} />
      </button>

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
