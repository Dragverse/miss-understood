"use client";

import { useState, useEffect } from "react";
import { VideoCard } from "@/components/video/video-card";
import { FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import { HeroSection } from "@/components/home/hero-section";
import { BytesSection } from "@/components/home/bytes-section";
import { CommunitySection } from "@/components/home/community-section";
import { RightSidebar } from "@/components/home/right-sidebar";
import { LiveNowSection } from "@/components/home/live-now-section";
import { TrendingPhotosSection } from "@/components/home/trending-photos-section";
import { getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { USE_MOCK_DATA } from "@/lib/config/env";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { VideoGridSkeleton, ShortsSectionSkeleton } from "@/components/loading/video-card-skeleton";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoPosts, setPhotoPosts] = useState<any[]>([]);

  // Fetch videos from Supabase and Bluesky in parallel
  useEffect(() => {
    async function loadVideos() {
      setLoading(true);

      // Load local videos immediately (synchronous)
      const localVideos = getLocalVideos();
      if (localVideos.length > 0) {
        setVideos(localVideos);
        console.log(`Loaded ${localVideos.length} videos from local storage`);
      }

      // Fetch Supabase and Bluesky in parallel (non-blocking)
      // Track failed sources to notify user
      const failedSources: string[] = [];

      // Supabase videos
      const supabasePromise = !USE_MOCK_DATA
        ? getVideos(50)
            .then((result) => {
              if (result && result.length > 0) {
                const ceramicVideos = result.map((v: any) => ({
                  id: v.id,
                  title: v.title,
                  description: v.description || "",
                  thumbnail: v.thumbnail || "/default-thumbnail.jpg",
                  duration: v.duration || 0,
                  views: v.views || 0,
                  likes: v.likes || 0,
                  createdAt: new Date(v.created_at),
                  playbackUrl: v.playback_url || "",
                  livepeerAssetId: v.livepeer_asset_id,
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
                }));
                console.log(`Loaded ${ceramicVideos.length} videos from Supabase`);
                return ceramicVideos;
              }
              return [];
            })
            .catch((error) => {
              console.warn("Failed to load videos from Supabase:", error);
              failedSources.push("Dragverse");
              return [];
            })
        : Promise.resolve([]);

      // Bluesky content (fetch ALL content types: videos, images, text)
      const blueskyPromise = fetch("/api/bluesky/feed?limit=100&contentType=all")
        .then((response) => response.json())
        .then((data) => {
          const blueskyContent = data.posts || data.videos || [];
          if (data.success && blueskyContent.length > 0) {
            console.log(`Loaded ${blueskyContent.length} posts from Bluesky (videos, images, text)`);

            // Extract photo posts
            const photos = blueskyContent.filter((post: any) =>
              post.thumbnail &&
              !post.playbackUrl?.includes("m3u8") &&
              !post.playbackUrl?.includes("youtube") &&
              !post.playbackUrl?.includes("vimeo") &&
              !post.playbackUrl?.includes("tiktok")
            ).slice(0, 15);

            setPhotoPosts(photos);
            return blueskyContent;
          }
          return [];
        })
        .catch((error) => {
          console.warn("Failed to load videos from Bluesky:", error);
          failedSources.push("Bluesky");
          return [];
        });

      // YouTube drag content (100 videos from curated channels via RSS - no quota limits!)
      const youtubePromise = fetch("/api/youtube/feed?limit=100&rssOnly=true")
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.videos.length > 0) {
            console.log(`Loaded ${data.videos.length} videos from YouTube`);
            return data.videos;
          }
          return [];
        })
        .catch((error) => {
          console.warn("Failed to load videos from YouTube:", error);
          failedSources.push("YouTube");
          return [];
        });

      // Wait for all fetches to complete in parallel
      const results = await Promise.all([supabasePromise, blueskyPromise, youtubePromise]);

      // Notify user if some sources failed (but not all)
      if (failedSources.length > 0 && failedSources.length < 3) {
        toast.error(`Some content sources unavailable: ${failedSources.join(", ")}`, {
          duration: 4000,
        });
      }

      // Combine all videos (no quality filtering - trust curated sources)
      const allVideos = [...localVideos, ...results.flat()];

      // Sort by date (newest first)
      if (allVideos.length > 0) {
        allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      console.log(`[Homepage] Loaded ${allVideos.length} videos from all sources (no filtering)`);

      setVideos(allVideos);
      setLoading(false);
    }

    loadVideos();
  }, []);

  // PRIORITY 1: Dragverse Bytes (native user uploads) - ALWAYS SHOW THESE FIRST
  const dragverseBytes = videos.filter((v) =>
    v.contentType === "short" &&
    ((v as any).source === "ceramic" || !(v as any).source)
  );

  // PRIORITY 2: YouTube Shorts from curated drag channels
  const youtubeShorts = videos.filter((v) =>
    v.contentType === "short" &&
    (v as any).source === "youtube"
  );

  // PRIORITY 3: Bluesky vertical videos
  const blueskyShorts = videos.filter((v) =>
    v.contentType === "short" &&
    (v as any).source === "bluesky"
  );

  // Show Dragverse Bytes FIRST (native content always prioritized)
  // Then fill with YouTube, then Bluesky (up to 15 total)
  const shorts = [
    ...dragverseBytes,
    ...youtubeShorts.slice(0, Math.max(0, 12 - dragverseBytes.length)),
    ...blueskyShorts.slice(0, Math.max(0, 15 - dragverseBytes.length - Math.min(youtubeShorts.length, 12 - dragverseBytes.length)))
  ].slice(0, 15);

  // Horizontal videos - prioritize Dragverse first
  const dragverseVideos = videos.filter((v) =>
    v.contentType !== "short" &&
    ((v as any).source === "ceramic" || !(v as any).source)
  );
  const youtubeVideos = videos.filter((v) =>
    v.contentType !== "short" &&
    (v as any).source === "youtube"
  );
  const blueskyVideos = videos.filter((v) =>
    v.contentType !== "short" &&
    (v as any).source === "bluesky"
  );

  const horizontalVideos = [...dragverseVideos, ...youtubeVideos, ...blueskyVideos];

  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.creator.displayName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // If searching, show filtered results in grid
  const isFiltering = searchQuery.length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-9 space-y-10">
          {/* Categories - Hidden until we have more content
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition-all ${
                  activeCategory === category
                    ? "bg-white text-[#0f071a]"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          */}

          {isFiltering ? (
            <>
              {/* Search Bar when filtering */}
              <div className="relative max-w-xl">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for channel or hashtag"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-transparent focus:border-[#EB83EA]/30 rounded-full text-sm transition-all outline-none"
                />
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-400">
                {filteredVideos.length}{" "}
                {filteredVideos.length === 1 ? "video" : "videos"}
                {searchQuery && ` matching "${searchQuery}"`}
              </div>

              {/* Filtered Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>

              {filteredVideos.length === 0 && (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1a0b2e] mb-4">
                    <FiSearch className="text-2xl text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-lg font-medium">
                    No videos found
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </>
          ) : loading ? (
            <>
              {/* Hero Section */}
              <HeroSection />

              {/* Loading skeletons while data fetches */}
              <div className="space-y-10">
                {/* Shorts skeleton */}
                <ShortsSectionSkeleton />

                {/* Community videos skeleton */}
                <div className="space-y-4">
                  <div className="h-8 bg-white/10 rounded-md w-48 animate-pulse" />
                  <VideoGridSkeleton count={6} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Hero Section */}
              <HeroSection />

              {/* Live Now Section (shows when creators are streaming) */}
              <LiveNowSection />

              {/* Dragverse Bytes (Shorts) - Show FIRST to highlight native content */}
              {shorts.length > 0 && <BytesSection shorts={shorts} />}

              {/* Trending Photos - Drag looks and performances from Bluesky */}
              {photoPosts.length > 0 && <TrendingPhotosSection photos={photoPosts} />}

              {/* Community Videos Section */}
              <CommunitySection videos={horizontalVideos} />
            </>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="col-span-3">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
