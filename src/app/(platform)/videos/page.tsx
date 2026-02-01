"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { VideoCard } from "@/components/video/video-card";
import { categories } from "@/lib/utils/mock-data";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { FiSearch, FiRefreshCw, FiVideo } from "react-icons/fi";

export default function VideosPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newContentAvailable, setNewContentAvailable] = useState(false);

  // Deduplicate videos by ID
  const deduplicateVideos = (videos: Video[]) => {
    const seen = new Set<string>();
    return videos.filter(video => {
      const id = video.id || video.externalUrl || `${video.source}-${video.title}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  // Sort videos - Dragverse priority with ALL content types
  const sortVideos = (dragverseVideos: Video[], externalVideos: Video[]) => {
    // Dragverse: Show BOTH vertical and horizontal (all content types)
    const allDragverse = dragverseVideos;

    // External: Only horizontal (supplement)
    const externalHorizontal = externalVideos.filter(v => v.contentType !== "short");

    // Sort by date (newest first)
    allDragverse.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    externalHorizontal.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log(`[Videos] Dragverse: ${allDragverse.length} (all types), External: ${externalHorizontal.length} (horizontal only)`);

    // Return: ALL Dragverse first, then external supplements
    return [...allDragverse, ...externalHorizontal];
  };

  async function loadVideos(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log("[Videos] Fetching from all sources in parallel...");

      // Fetch from ALL sources in parallel
      const [supabaseVideos, blueskyVideos, youtubeVideos] = await Promise.all([
        // Supabase/Dragverse videos
        getVideos(50).catch((err) => {
          console.warn("[Videos] Supabase fetch failed:", err);
          return [];
        }),
        // Bluesky videos (video content only for /videos page)
        fetch("/api/bluesky/feed?limit=30&contentType=videos")
          .then((res) => (res.ok ? res.json() : { posts: [] }))
          .then((data) => data.posts || [])
          .catch((err) => {
            console.warn("[Videos] Bluesky fetch failed:", err);
            return [];
          }),
        // YouTube videos (RSS-only, no API)
        fetch("/api/youtube/feed?limit=30&rssOnly=true")
          .then((res) => (res.ok ? res.json() : { videos: [] }))
          .then((data) => data.videos || [])
          .catch((err) => {
            console.warn("[Videos] YouTube RSS fetch failed:", err);
            return [];
          }),
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
        contentType: (v.content_type as any) || "long",
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
        category: v.category || "",
        tags: v.tags || [],
        source: "ceramic" as const,
      })) as Video[];

      // Separate Dragverse from external
      const dragverseVideos = transformedSupabase;
      const externalVideos = [
        ...(blueskyVideos || []),
        ...(youtubeVideos || []),
        ...getLocalVideos(),
      ];

      console.log(`[Videos] Loaded ${dragverseVideos.length} Dragverse, ${blueskyVideos?.length || 0} Bluesky, ${youtubeVideos?.length || 0} YouTube videos`);

      // Deduplicate and sort by date
      const dedupedDragverse = deduplicateVideos(dragverseVideos);
      const dedupedExternal = deduplicateVideos(externalVideos);
      const sortedVideos = sortVideos(dedupedDragverse, dedupedExternal);

      setVideos(sortedVideos);

      // If this was a refresh, show notification if new content was found
      if (isRefresh && sortedVideos.length > 0) {
        setNewContentAvailable(true);
        setTimeout(() => setNewContentAvailable(false), 5000);
      }
    } catch (error) {
      console.error("[Videos] Failed to load videos:", error);
      // Fallback to local videos only
      setVideos(getLocalVideos());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadVideos();
  }, []);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadVideos(true);
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, []);

  // Display all videos (sortVideos already handles filtering)
  // Dragverse shows all content types, external only shows horizontal
  const displayVideos = videos;

  const filteredVideos = displayVideos.filter((video) => {
    const matchesCategory =
      activeCategory === "All" || video.category === activeCategory;
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (video.creator?.displayName || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiVideo className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                EXPLORE
              </h1>
              <p className="text-gray-400 text-sm">
                Discover drag performances and content from across the multiverse
              </p>
            </div>
          </div>
          {/* Manual Refresh Button */}
          <button
            onClick={() => loadVideos(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full font-medium transition-all disabled:opacity-50"
            title="Refresh videos"
          >
            <FiRefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* New Content Available Banner */}
      {newContentAvailable && (
        <div className="mb-6 bg-gradient-to-r from-[#EB83EA]/20 to-[#7c3aed]/20 border-2 border-[#EB83EA]/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#EB83EA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">New videos available! Feed has been updated.</p>
          </div>
          <button
            onClick={() => setNewContentAvailable(false)}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-2xl">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder="Search videos, creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#18122D] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] focus:bg-[#18122D] transition placeholder:text-gray-500 text-[#FCF1FC]"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium text-sm transition-all ${
                activeCategory === category
                  ? "bg-[#EB83EA] text-white shadow-lg"
                  : "bg-[#18122D] text-gray-300 hover:bg-[#2f2942] border border-[#2f2942]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || activeCategory !== "All") && (
        <div className="mb-4 text-sm text-gray-400">
          {filteredVideos.length} {filteredVideos.length === 1 ? "video" : "videos"}
          {searchQuery && ` matching "${searchQuery}"`}
          {activeCategory !== "All" && ` in ${activeCategory}`}
        </div>
      )}

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8">
        {filteredVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 mb-6">
            <FiSearch className="text-3xl text-[#EB83EA]" />
          </div>
          <h3 className="text-white text-xl font-bold mb-2 uppercase tracking-wide">
            {videos.length === 0 ? "The Stage is Empty" : "No performances found"}
          </h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            {videos.length === 0
              ? "The curtain is waiting to rise. Be the first to share your drag performances, tutorials, or backstage moments!"
              : `No performances match "${searchQuery}" in ${activeCategory}. Try different keywords or browse all categories.`}
          </p>
          {videos.length === 0 && (
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30"
            >
              Upload Video
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
