"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { FiMessageSquare, FiTrendingUp, FiPlus, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/lib/privy/hooks";
import { PostCard as BlueskyPostCard } from "@/components/feed/post-card";
import { PostCard } from "@/components/posts/post-card";
import { PostComposer } from "@/components/posts/post-composer";
import { FeedRightSidebar } from "@/components/feed/feed-right-sidebar";
import { CardSkeleton } from "@/components/shared";

function FeedContent() {
  const { isAuthenticated } = useAuthUser();
  const searchParams = useSearchParams();
  const filter = searchParams?.get("filter");
  const hashtag = searchParams?.get("hashtag");
  const showBookmarks = filter === "bookmarks";

  const [posts, setPosts] = useState<any[]>([]);
  const [dragversePosts, setDragversePosts] = useState<any[]>([]);
  const [dragverseLoading, setDragverseLoading] = useState(true);
  const [externalLoading, setExternalLoading] = useState(true);
  const [hasBluesky, setHasBluesky] = useState(false);
  const [sortBy, setSortBy] = useState<"engagement" | "recent">("engagement");
  const [contentFilter, setContentFilter] = useState<"all" | "youtube" | "bluesky" | "dragverse">("all");
  const [showComposer, setShowComposer] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newContentAvailable, setNewContentAvailable] = useState(false);

  // Suppress YouTube tracking errors (blocked by ad blockers)
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      const msg = args[0]?.toString() || '';
      if (msg.includes('youtube.com/youtubei') || msg.includes('ERR_BLOCKED_BY_CLIENT')) {
        return;
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  // Check Bluesky session status (non-blocking)
  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/bluesky/session")
        .then((res) => res.json())
        .then((data) => setHasBluesky(data.connected))
        .catch(() => {});

      // Background backfill
      fetch("/api/posts/backfill-creators", { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, [isAuthenticated]);

  // Handle post deletion
  const handlePostDeleted = (postId: string) => {
    setDragversePosts((posts) => posts.filter((p) => p.id !== postId));
  };

  // Deduplicate content by ID/URI
  const deduplicateContent = useCallback((content: any[]) => {
    const seen = new Set<string>();
    return content.filter(item => {
      const id = item.id || item.uri || item.externalUrl || `${item.type}-${item.title}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, []);

  // Progressive feed loading - Dragverse first, then external sources
  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setDragverseLoading(true);
      setExternalLoading(true);
    }
    setSearchError(null);

    // Load Dragverse posts FIRST (fast, our own DB)
    try {
      const dragverseRes = await fetch("/api/posts/feed?limit=20");
      if (dragverseRes.ok) {
        const data = await dragverseRes.json();
        let dragverseData = deduplicateContent(data.posts || []);
        dragverseData.sort((a: any, b: any) =>
          new Date(b.createdAt || b.created_at || b.indexedAt).getTime() -
          new Date(a.createdAt || a.created_at || a.indexedAt).getTime()
        );

        if (showBookmarks) {
          const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
          dragverseData = dragverseData.filter((post: any) => bookmarks.includes(post.id));
        }

        setDragversePosts(dragverseData);
      }
    } catch (error) {
      console.error("Failed to load Dragverse posts:", error);
    } finally {
      setDragverseLoading(false);
    }

    // Load external sources in background (slower, don't block UI)
    try {
      const [blueskyRes, youtubeRes] = await Promise.all([
        fetch(
          hashtag
            ? `/api/bluesky/search?q=${encodeURIComponent(hashtag)}&limit=30&contentType=all`
            : `/api/bluesky/feed?limit=30&sortBy=${sortBy}&contentType=all`
        ).catch(() => null),
        fetch("/api/youtube/feed?limit=20&rssOnly=true").catch(() => null),
      ]);

      let externalPosts: any[] = [];

      if (blueskyRes?.ok) {
        const blueskyData = await blueskyRes.json();
        if (blueskyData.error) {
          setSearchError(blueskyData.error);
        } else {
          externalPosts = [...externalPosts, ...(blueskyData.posts || [])];
        }
      }

      if (youtubeRes?.ok) {
        const youtubeData = await youtubeRes.json();
        if (youtubeData.success && youtubeData.videos) {
          const youtubePosts = youtubeData.videos.map((video: any) => ({
            id: video.id,
            type: "youtube-video",
            description: video.description || video.title,
            source: "youtube",
            thumbnail: video.thumbnail,
            likes: video.likes || 0,
            views: video.views || 0,
            creator: {
              displayName: video.creator?.displayName || "YouTube Channel",
              handle: video.creator?.handle || "youtube",
              avatar: video.creator?.avatar || "/defaultpfp.png",
              did: video.creator?.did,
            },
            createdAt: video.createdAt,
            externalUrl: video.externalUrl,
            playbackUrl: video.playbackUrl || video.externalUrl,
            contentType: video.contentType,
          }));
          externalPosts = [...externalPosts, ...youtubePosts];
        }
      }

      externalPosts = deduplicateContent(externalPosts);
      externalPosts.sort((a: any, b: any) =>
        new Date(b.createdAt || b.indexedAt).getTime() -
        new Date(a.createdAt || a.indexedAt).getTime()
      );

      if (showBookmarks) {
        const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
        externalPosts = externalPosts.filter((post: any) => bookmarks.includes(post.id));
      }

      setPosts(externalPosts);

      if (isRefresh && externalPosts.length > 0) {
        setNewContentAvailable(true);
        setTimeout(() => setNewContentAvailable(false), 5000);
      }
    } catch (error) {
      console.error("Failed to load external feed:", error);
    } finally {
      setExternalLoading(false);
      setRefreshing(false);
    }
  }, [sortBy, showBookmarks, hashtag, deduplicateContent]);

  // Initial load
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => loadFeed(true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadFeed]);

  const handlePostCreated = () => {
    fetch("/api/posts/feed?limit=20")
      .then((res) => res.json())
      .then((data) => setDragversePosts(data.posts || []))
      .catch((error) => console.error("Failed to reload posts:", error));
    setShowComposer(false);
  };

  // Compute loading state - show skeleton only while Dragverse (primary) is loading
  const loading = dragverseLoading;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* Header - Compact on mobile */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="flex items-center gap-2 text-2xl md:text-3xl lg:text-4xl font-heading uppercase tracking-wide font-black">
                <FiMessageSquare className="w-5 h-5 md:w-6 md:h-6 text-[#EB83EA]" />
                {showBookmarks
                  ? "Bookmarks"
                  : hashtag
                  ? hashtag
                  : "What's Happening"}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadFeed(true)}
                  disabled={refreshing}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all disabled:opacity-50 border border-white/10"
                  aria-label="Refresh feed"
                >
                  <FiRefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                {isAuthenticated && !showBookmarks && (
                  <button
                    onClick={() => setShowComposer(!showComposer)}
                    className="flex items-center gap-2 px-4 py-3 md:px-6 bg-gradient-to-r from-[#EB83EA] via-[#D946EF] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6b2fd5] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30 hover:scale-105 transform"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span className="hidden sm:inline">{showComposer ? "Cancel" : "Share Your Story"}</span>
                    <span className="sm:hidden">{showComposer ? "Cancel" : "Post"}</span>
                  </button>
                )}
              </div>
            </div>
            <p className="hidden md:block text-gray-400 text-sm">
              {showBookmarks
                ? "Posts you've saved to read later"
                : hashtag
                ? `Posts tagged with ${hashtag}`
                : "Share what's happening behind the scenes"}
            </p>
          </div>

          {/* New Content Available Banner */}
          {newContentAvailable && (
            <div className="mb-6 bg-gradient-to-r from-[#EB83EA]/20 to-[#7c3aed]/20 border-2 border-[#EB83EA]/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiTrendingUp className="w-5 h-5 text-[#EB83EA]" />
                <p className="text-sm font-medium">New content available! Feed has been updated.</p>
              </div>
              <button
                onClick={() => setNewContentAvailable(false)}
                className="text-gray-400 hover:text-white transition"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Post Composer */}
          {showComposer && isAuthenticated && (
            <div className="mb-8">
              <PostComposer onPostCreated={handlePostCreated} />
            </div>
          )}

          {/* Sort and Filter Controls */}
          {!showBookmarks && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                <button
                  onClick={() => setSortBy("engagement")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === "engagement"
                      ? "bg-[#EB83EA] text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                  aria-label="Sort by trending"
                >
                  Trending
                </button>
                <button
                  onClick={() => setSortBy("recent")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === "recent"
                      ? "bg-[#EB83EA] text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                  aria-label="Sort by recent"
                >
                  Recent
                </button>
              </div>

              <div className="w-px h-5 bg-white/10 hidden sm:block" />

              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: "all", label: "All", color: "bg-[#EB83EA]" },
                  { key: "dragverse", label: "Dragverse", color: "bg-purple-500" },
                  { key: "youtube", label: "YouTube", color: "bg-red-500" },
                  { key: "bluesky", label: "Bluesky", color: "bg-blue-500" },
                ] as const).map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setContentFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      contentFilter === key
                        ? `${color} text-white shadow-sm`
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                    aria-label={`Filter by ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Error Alert */}
          {searchError && (
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-red-300 font-bold mb-2">Search Error</h3>
                  <p className="text-red-200 text-sm mb-3">{searchError}</p>
                  {searchError.includes("authentication") && (
                    <p className="text-red-300 text-xs">
                      Bluesky authentication is required for search. Please configure BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in your environment variables.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dragverse Native Posts */}
              {dragversePosts
                .filter((post) => {
                  if (contentFilter === "all") return true;
                  if (contentFilter === "dragverse") return (post as any).source === "dragverse" || (post as any).source === "ceramic";
                  return false;
                })
                .map((post) => (
                  <BlueskyPostCard
                    key={`dragverse-${post.id}`}
                    post={{
                      ...post,
                      description: post.text_content || post.description || "",
                      createdAt: post.created_at || post.createdAt,
                      thumbnail: post.media_urls?.[0] || post.thumbnail,
                      creator: post.creator ? {
                        displayName: post.creator.display_name || post.creator.displayName,
                        handle: post.creator.handle,
                        avatar: post.creator.avatar,
                        did: post.creator.did,
                        blueskyHandle: post.creator.blueskyHandle,
                      } : post.creator,
                    }}
                  />
                ))}

              {/* External content loading indicator */}
              {externalLoading && contentFilter !== "dragverse" && (
                <div className="flex items-center justify-center py-4 gap-3 text-gray-400">
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading more content...</span>
                </div>
              )}

              {/* External Posts (Bluesky, YouTube, etc.) */}
              {posts
                .filter((post) => {
                  if (contentFilter === "all") return true;
                  if (contentFilter === "youtube") return (post as any).source === "youtube";
                  if (contentFilter === "bluesky") return (post as any).source !== "youtube" && (post as any).source !== "dragverse" && (post as any).source !== "ceramic";
                  if (contentFilter === "dragverse") return false;
                  return false;
                })
                .map((post) => (
                  <BlueskyPostCard key={`external-${post.id}`} post={post} />
                ))}

              {dragversePosts.filter((post) => {
                if (contentFilter === "all") return true;
                if (contentFilter === "dragverse") return (post as any).source === "dragverse" || (post as any).source === "ceramic";
                return false;
              }).length === 0 && posts.filter((post) => {
                if (contentFilter === "all") return true;
                if (contentFilter === "youtube") return (post as any).source === "youtube";
                if (contentFilter === "bluesky") return (post as any).source !== "youtube" && (post as any).source !== "dragverse" && (post as any).source !== "ceramic";
                if (contentFilter === "dragverse") return false;
                return false;
              }).length === 0 && !externalLoading && !searchError && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center">
                    <FiMessageSquare className="w-10 h-10 text-[#EB83EA]" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">
                    {showBookmarks ? "No Bookmarks Yet" : "The Stage is Set"}
                  </h2>
                  <p className="text-gray-400 text-lg mb-2">
                    {showBookmarks
                      ? "Start bookmarking posts to save them here"
                      : "Waiting for the first act to begin"}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {showBookmarks
                      ? "Tap the bookmark icon on any post to save it"
                      : "Be the first to share something fabulous with the community"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block col-span-3">
          <FeedRightSidebar />
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
          <div className="max-w-2xl mx-auto space-y-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}
