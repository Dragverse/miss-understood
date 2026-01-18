"use client";

import { useState, useEffect } from "react";
import { VideoCard } from "@/components/video/video-card";
import { FiSearch } from "react-icons/fi";
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

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoPosts, setPhotoPosts] = useState<any[]>([]);

  // Fetch videos from Ceramic and Bluesky on mount
  useEffect(() => {
    async function loadVideos() {
      setLoading(true);
      const allVideos: Video[] = [];

      // Load from Ceramic if not using mock data
      if (!USE_MOCK_DATA) {
        try {
          const result = await getVideos(50); // Fetch first 50 videos
          if (result && result.length > 0) {
            // Convert Supabase videos to our Video type
            const ceramicVideos = result.map((v: any) => ({
              id: v.id,
              title: v.title,
              description: v.description || "",
              thumbnail: v.thumbnail || "",
              duration: v.duration || 0,
              views: v.views || 0,
              likes: v.likes || 0,
              createdAt: new Date(v.created_at),
              playbackUrl: v.playback_url || "",
              livepeerAssetId: v.livepeer_asset_id,
              contentType: v.content_type,
              creator: v.creator || {
                did: v.creator_did,
                handle: "creator",
                displayName: "Creator",
                avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${v.creator_did}`,
                description: "",
                followerCount: 0,
                followingCount: 0,
                createdAt: new Date(),
                verified: false,
              },
              category: v.category || "Other",
              tags: Array.isArray(v.tags) ? v.tags : (v.tags ? v.tags.split(',') : []),
            }));
            allVideos.push(...ceramicVideos);
            console.log(`Loaded ${ceramicVideos.length} videos from Ceramic`);
          }
        } catch (error) {
          console.warn("Failed to load videos from Ceramic:", error);
        }
      }

      // Always fetch Bluesky content to populate feed
      try {
        const response = await fetch("/api/bluesky/feed?limit=30");
        const data = await response.json();

        // API returns both 'posts' and 'videos' - use posts for consistency
        const blueskyContent = data.posts || data.videos || [];
        if (data.success && blueskyContent.length > 0) {
          allVideos.push(...blueskyContent);
          console.log(`Loaded ${blueskyContent.length} videos from Bluesky`);

          // Extract photo posts (with images but no videos)
          const photos = blueskyContent.filter((post: any) =>
            post.thumbnail &&
            !post.playbackUrl?.includes("m3u8") &&
            !post.playbackUrl?.includes("youtube") &&
            !post.playbackUrl?.includes("vimeo") &&
            !post.playbackUrl?.includes("tiktok")
          ).slice(0, 15); // Top 15 photo posts

          setPhotoPosts(photos);
        }
      } catch (error) {
        console.warn("Failed to load videos from Bluesky:", error);
      }

      // Add local uploads from localStorage
      const localVideos = getLocalVideos();
      if (localVideos.length > 0) {
        allVideos.push(...localVideos);
        console.log(`Loaded ${localVideos.length} videos from local storage`);
      }

      // Sort by date (newest first) and set videos
      if (allVideos.length > 0) {
        allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      setVideos(allVideos);
      setLoading(false);
    }

    loadVideos();
  }, []);

  // Separate shorts and regular videos
  const shorts = videos.filter((v) => v.contentType === "short");
  const horizontalVideos = videos.filter((v) => v.contentType !== "short");

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
          ) : (
            <>
              {/* Hero Section */}
              <HeroSection />

              {/* Live Now Section (shows when creators are streaming) */}
              <LiveNowSection />

              {/* Trending Photos */}
              <TrendingPhotosSection photos={photoPosts} />

              {/* Bytes (Shorts) Section */}
              <BytesSection shorts={shorts} />

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
