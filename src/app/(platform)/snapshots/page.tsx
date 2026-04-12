"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Video } from "@/types";
import { ShortVideo } from "@/components/snapshots/short-video";
import { HeroSlider } from "@/components/home/hero-slider";
import { SnapshotsSection } from "@/components/home/snapshots-section";
import { RightSidebar } from "@/components/home/right-sidebar";
import { SponsoredImage } from "@/components/ads/sponsored-image";
import { AdSenseUnit } from "@/components/ads/adsense-unit";
import { LoadingShimmer } from "@/components/shared";
import Image from "next/image";

function SnapshotsContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v");
  const [snapshots, setSnapshots] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [socialStatus, setSocialStatus] = useState<{
    likes: Record<string, boolean>;
    follows: Record<string, boolean>;
  }>({ likes: {}, follows: {} });

  // Load Dragverse snapshots
  async function loadSnapshots(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/videos/list?limit=100&contentType=short");
      const data = await response.json();

      if (!data.success || !data.videos) {
        console.warn("[Snapshots] API returned no videos");
        setSnapshots([]);
        return;
      }

      const shorts: Video[] = data.videos.map((v: any) => ({
        id: v.id,
        title: v.title,
        description: v.description || "",
        thumbnail: v.thumbnail || null,
        duration: v.duration || 0,
        views: v.views || 0,
        likes: v.likes || 0,
        createdAt: new Date(v.created_at),
        playbackUrl: v.playback_url || '',
        livepeerAssetId: v.playback_id || v.livepeer_asset_id || '',
        contentType: v.content_type,
        creator: v.creator ? {
          did: v.creator.did,
          handle: v.creator.handle,
          displayName: v.creator.display_name,
          avatar: v.creator.avatar || "/defaultpfp.png",
          description: "",
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date(),
          verified: v.creator.verified || false,
        } : {
          did: v.creator_did,
          handle: "creator",
          displayName: "Creator",
          avatar: "/defaultpfp.png",
          description: "",
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date(),
          verified: false,
        },
        category: v.category || "Other",
        tags: Array.isArray(v.tags) ? v.tags : (v.tags ? v.tags.split(',') : []),
        source: "ceramic" as const,
      })).filter((v: Video) => v.contentType === "short");

      // Sort by date (newest first)
      shorts.sort((a: Video, b: Video) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(`[Snapshots] Loaded ${shorts.length} Dragverse shorts`);
      setSnapshots(shorts);

      // If deep-linking to a specific video, set the index
      if (videoId && !isRefresh) {
        const idx = shorts.findIndex((s) => s.id === videoId);
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
      }
    } catch (error) {
      console.error("[Snapshots] Failed to load:", error);
      setSnapshots([]);
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
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Batch fetch social status (likes/follows) when snapshots load
  useEffect(() => {
    if (snapshots.length === 0) return;

    async function fetchSocialStatus() {
      try {
        const videoIds = snapshots.map(v => v.id);
        const creatorDIDs = [...new Set(snapshots.map(v => v.creator.did))];

        const response = await fetch('/api/social/batch-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ videoIds, creatorDIDs }),
        });

        const data = await response.json();
        if (data.success) {
          setSocialStatus({
            likes: data.likes || {},
            follows: data.follows || {},
          });
        }
      } catch (error) {
        console.error('[Snapshots] Failed to fetch social status:', error);
      }
    }

    fetchSocialStatus();
  }, [snapshots]);

  // Broadcast: auto-advance to next video
  const handleVideoEnded = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % snapshots.length);
  }, [snapshots.length]);

  // Broadcast: auto-skip broken videos
  const handleVideoError = useCallback(() => {
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % snapshots.length);
    }, 2000);
  }, [snapshots.length]);

  // Keyboard: Space to pause is handled by ShortVideo, arrow keys to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % snapshots.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + snapshots.length) % snapshots.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [snapshots.length]);

  // Shared video player + overlays
  const currentVideo = snapshots.length > 0 ? snapshots[currentIndex] : null;

  const videoPlayer = currentVideo ? (
    <div className="relative h-full w-full flex items-center justify-center">
      {/* Retro TV Frame */}
      <div className="relative flex flex-col items-center h-full w-full lg:max-w-[460px]">
        {/* Rabbit-ear Antenna */}
        <div className="hidden md:flex items-end justify-center gap-0 mb-0 relative h-14 flex-shrink-0">
          {/* Left antenna */}
          <div className="relative" style={{ transform: 'rotate(-25deg)', transformOrigin: 'bottom center' }}>
            <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
          </div>
          {/* Right antenna */}
          <div className="relative" style={{ transform: 'rotate(25deg)', transformOrigin: 'bottom center' }}>
            <div className="w-[3px] h-12 bg-gradient-to-t from-[#EB83EA] to-[#F3A8F2] rounded-full" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#F3A8F2] shadow-md shadow-[#EB83EA]/50" />
          </div>
        </div>

        {/* TV Body */}
        <div className="relative flex-1 w-full min-h-0 p-1.5 md:p-2 bg-gradient-to-b from-[#EB83EA] to-[#E748E6] md:rounded-[2rem] shadow-xl shadow-[#EB83EA]/20">
          {/* Screen (inner area) */}
          <div className="relative h-full w-full md:rounded-[1.5rem] overflow-hidden bg-gray-950">
            <ShortVideo
              key={currentVideo.id}
              video={currentVideo}
              isActive={true}
              onNext={() => setCurrentIndex(prev => (prev + 1) % snapshots.length)}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              initialLiked={socialStatus.likes[currentVideo.id]}
              initialFollowing={socialStatus.follows[currentVideo.creator.did]}
            />
            {/* Logo as refresh button — top left */}
            <button
              onClick={() => loadSnapshots(true)}
              disabled={refreshing}
              className="absolute top-2 md:top-4 left-2 md:left-4 z-30 p-1.5 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition disabled:opacity-50"
              aria-label="Refresh snapshots"
            >
              <Image
                src="/logo.svg"
                alt="Dragverse TV"
                width={32}
                height={32}
                className={`w-8 h-8 ${refreshing ? 'animate-spin' : 'hover:scale-110 transition-transform'}`}
              />
            </button>
          </div>
        </div>

        {/* TV Stand */}
        <div className="hidden md:flex items-center justify-center flex-shrink-0">
          <div className="w-20 h-3 bg-gradient-to-b from-[#E748E6] to-[#EB83EA] rounded-b-lg" />
        </div>
      </div>
    </div>
  ) : null;

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="bg-black min-h-[100dvh] md:min-h-[calc(100vh-4rem)]">
        {/* Desktop: 3-column */}
        <div className="hidden lg:grid grid-cols-12 gap-4 h-[calc(100vh-4rem)] px-4 py-4 max-w-[1600px] mx-auto">
          <div className="col-span-3 overflow-y-auto scrollbar-hide space-y-4 py-2">
            <div className="rounded-[24px] overflow-hidden h-[400px]">
              <HeroSlider />
            </div>
            <SponsoredImage
              href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
              imageSrc="/salti-blanket.webp"
              imageAlt="Salti Premium Sherpa Blanket"
            />
            <AdSenseUnit />
          </div>
          <div className="col-span-6 flex items-center justify-center">
            <div className="max-w-[420px] w-full h-full p-4">
              <LoadingShimmer className="h-full" />
            </div>
          </div>
          <div className="col-span-3 overflow-y-auto">
            <RightSidebar />
          </div>
        </div>
        {/* Mobile */}
        <div className="lg:hidden h-[100dvh]">
          <LoadingShimmer className="h-full w-full" />
        </div>
      </div>
    );
  }

  // ─── Empty State ───
  if (snapshots.length === 0) {
    return (
      <div className="bg-black min-h-[100dvh] md:min-h-[calc(100vh-4rem)]">
        {/* Desktop: 3-column */}
        <div className="hidden lg:grid grid-cols-12 gap-4 h-[calc(100vh-4rem)] px-4 py-4 max-w-[1600px] mx-auto">
          <div className="col-span-3 overflow-y-auto scrollbar-hide space-y-4 py-2">
            <div className="rounded-[24px] overflow-hidden h-[400px]">
              <HeroSlider />
            </div>
            <SponsoredImage
              href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
              imageSrc="/salti-blanket.webp"
              imageAlt="Salti Premium Sherpa Blanket"
            />
            <AdSenseUnit />
          </div>
          <div className="col-span-6 flex items-center justify-center">
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
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30 text-white"
              >
                Upload Your First Short
              </Link>
            </div>
          </div>
          <div className="col-span-3 overflow-y-auto">
            <RightSidebar />
          </div>
        </div>
        {/* Mobile */}
        <div className="lg:hidden h-[100dvh] md:h-[calc(100vh-4rem)] flex items-center justify-center">
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
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30 text-white"
            >
              Upload Your First Short
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Layout ───
  return (
    <div className="bg-black min-h-[100dvh] md:min-h-[calc(100vh-4rem)]">
      {/* Desktop: 3-column TikTok layout */}
      <div className="hidden lg:grid grid-cols-12 gap-4 h-[calc(100vh-4rem)] px-4 py-4 max-w-[1600px] mx-auto">
        {/* Left Sidebar - HeroSlider + Sponsored + AdSense */}
        <div className="col-span-3 overflow-y-auto scrollbar-hide space-y-4 py-2">
          <div className="rounded-[24px] overflow-hidden h-[400px]">
            <HeroSlider />
          </div>
          <SponsoredImage
            href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
            imageSrc="/salti-blanket.webp"
            imageAlt="Salti Premium Sherpa Blanket"
          />
          <AdSenseUnit />
        </div>

        {/* Center - Video Player + Snapshots Slider */}
        <div className="col-span-6 overflow-y-auto scrollbar-hide">
          <div className="relative h-[calc(100vh-6rem)]">
            {videoPlayer}
          </div>
          <div className="px-2 pb-6 pt-2">
            <SnapshotsSection shorts={snapshots} />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-3 h-full overflow-y-auto scrollbar-hide space-y-4 py-2">
          <RightSidebar />
        </div>
      </div>

      {/* Mobile: full-screen video, then content below */}
      <div className="lg:hidden">
        <div className="relative h-[100dvh] overflow-hidden">
          {videoPlayer}
        </div>
        <div className="px-4 pt-6 pb-12 space-y-6">
          <SnapshotsSection shorts={snapshots} />
          <div className="rounded-[24px] overflow-hidden h-[300px]">
            <HeroSlider />
          </div>
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}

export default function SnapshotsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] bg-black">
          <LoadingShimmer className="h-full w-full" />
        </div>
      }
    >
      <SnapshotsContent />
    </Suspense>
  );
}
