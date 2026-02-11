"use client";

import { Suspense, useState, useEffect } from "react";
import { FiMessageSquare, FiTrendingUp, FiPlus, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/lib/privy/hooks";
import { PostCard as BlueskyPostCard } from "@/components/feed/post-card";
import { PostCard } from "@/components/posts/post-card";
import { PostComposer } from "@/components/posts/post-composer";
import { FeedRightSidebar } from "@/components/feed/feed-right-sidebar";
import { ConnectionGate } from "@/components/feed/connection-gate";
import { CardSkeleton } from "@/components/shared";

function FeedContent() {
  const { isAuthenticated, farcasterHandle } = useAuthUser();
  const searchParams = useSearchParams();
  const filter = searchParams?.get("filter");
  const hashtag = searchParams?.get("hashtag");
  const showBookmarks = filter === "bookmarks";

  const [posts, setPosts] = useState<any[]>([]);
  const [dragversePosts, setDragversePosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBluesky, setHasBluesky] = useState(false);
  const [hasFarcaster, setHasFarcaster] = useState(false);
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
        return; // Suppress YouTube tracking errors
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  // Check Bluesky session status, Farcaster connection, and backfill posts
  useEffect(() => {
    async function checkBlueskySession() {
      try {
        const response = await fetch("/api/bluesky/session");
        const data = await response.json();
        setHasBluesky(data.connected);
      } catch (error) {
        console.error("Failed to check Bluesky session:", error);
      }
    }

    // Check if user has Farcaster connected (use same method as upload/post pages)
    async function checkFarcasterConnection() {
      try {
        const response = await fetch("/api/user/crosspost-settings");
        const data = await response.json();
        if (data.success) {
          setHasFarcaster(data.connected.farcaster);
        }
      } catch (error) {
        console.error("Failed to check Farcaster connection:", error);
      }
    }

    // Backfill any posts missing creator_id
    async function backfillPosts() {
      try {
        await fetch("/api/posts/backfill-creators", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        // Silent fail - this is just a background fix
      }
    }

    if (isAuthenticated) {
      checkBlueskySession();
      checkFarcasterConnection();
      backfillPosts();
    }
  }, [isAuthenticated]);

  // Handle post deletion
  const handlePostDeleted = (postId: string) => {
    setDragversePosts((posts) => posts.filter((p) => p.id !== postId));
  };

  // Deduplicate content by ID/URI
  const deduplicateContent = (content: any[]) => {
    const seen = new Set<string>();
    return content.filter(item => {
      const id = item.id || item.uri || item.externalUrl || `${item.type}-${item.title}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  // Sort content by date (no quality filtering - curated sources are already high quality)
  const sortContent = (dragversePosts: any[], externalPosts: any[]) => {
    // Sort by date (newest first)
    const sortedDragverse = [...dragversePosts].sort((a, b) =>
      new Date(b.createdAt || b.indexedAt).getTime() - new Date(a.createdAt || a.indexedAt).getTime()
    );
    const sortedExternal = [...externalPosts].sort((a, b) =>
      new Date(b.createdAt || b.indexedAt).getTime() - new Date(a.createdAt || a.indexedAt).getTime()
    );

    console.log(`[Feed] Dragverse: ${dragversePosts.length} posts, External: ${externalPosts.length} posts (no filtering)`);

    return {
      dragverse: sortedDragverse,
      external: sortedExternal,
    };
  };

  // Load feed with quality scoring and filtering
  async function loadFeed(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setSearchError(null);

    try {
      // Fetch from all sources in parallel for maximum content diversity
      const [dragverseRes, blueskyRes, youtubeRes] = await Promise.all([
        // Native Dragverse posts
        fetch("/api/posts/feed?limit=20").catch(() => null),

        // Bluesky content (or search if hashtag) - fetch ALL content types
        fetch(
          hashtag
            ? `/api/bluesky/search?q=${encodeURIComponent(hashtag)}&limit=30&contentType=all`
            : `/api/bluesky/feed?limit=30&sortBy=${sortBy}&contentType=all`
        ).catch(() => null),

        // YouTube drag content from curated channels (RSS feeds - no quota!)
        fetch("/api/youtube/feed?limit=20&rssOnly=true").catch(() => null)
      ]);

      // Parse Dragverse posts
      let dragverseData: any[] = [];
      if (dragverseRes?.ok) {
        const data = await dragverseRes.json();
        dragverseData = data.posts || [];
      }

      // Parse Bluesky and YouTube content
      let externalPosts: any[] = [];

      if (blueskyRes?.ok) {
        const blueskyData = await blueskyRes.json();
        if (blueskyData.error) {
          setSearchError(blueskyData.error);
        } else {
          // Bluesky posts already have the correct structure from blueskyPostToContent/blueskyPostToVideo
          externalPosts = [...externalPosts, ...(blueskyData.posts || [])];
        }
      }

      if (youtubeRes?.ok) {
        const youtubeData = await youtubeRes.json();
        if (youtubeData.success && youtubeData.videos) {
          // Convert YouTube videos to post format for unified feed display
          const youtubePosts = youtubeData.videos.map((video: any) => ({
            ...video,
            type: "youtube-video",
            text: video.description,
            source: "youtube",
            // Add post-like properties for BlueskyPostCard compatibility
            author: video.creator,
            uri: video.externalUrl,
            indexedAt: video.createdAt,
            // Ensure playbackUrl is set correctly
            playbackUrl: video.playbackUrl || video.externalUrl,
          }));
          externalPosts = [...externalPosts, ...youtubePosts];
        }
      }

      // Deduplicate content
      dragverseData = deduplicateContent(dragverseData);
      externalPosts = deduplicateContent(externalPosts);

      // Sort content by date (curated sources don't need quality filtering)
      const { dragverse, external } = sortContent(dragverseData, externalPosts);

      // Filter by bookmarks if needed
      if (showBookmarks) {
        const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
        setDragversePosts(dragverse.filter((post: any) => bookmarks.includes(post.id)));
        setPosts(external.filter((post: any) => bookmarks.includes(post.id)));
      } else {
        setDragversePosts(dragverse);
        setPosts(external);
      }

      // If this was a refresh, show notification if new content was found
      if (isRefresh && (dragverse.length > 0 || external.length > 0)) {
        setNewContentAvailable(true);
        setTimeout(() => setNewContentAvailable(false), 5000);
      }
    } catch (error) {
      console.error("Failed to load feed:", error);
      setSearchError(error instanceof Error ? error.message : "Failed to load feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadFeed();
  }, [sortBy, showBookmarks, hashtag]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadFeed(true);
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [sortBy, showBookmarks, hashtag]);

  const handlePostCreated = () => {
    // Reload Dragverse posts
    fetch("/api/posts/feed?limit=20")
      .then((res) => res.json())
      .then((data) => setDragversePosts(data.posts || []))
      .catch((error) => console.error("Failed to reload posts:", error));

    setShowComposer(false);
  };

  // Show connection gate if user doesn't have Bluesky or Farcaster connected
  const hasConnection = hasBluesky || hasFarcaster;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {/* Connection Gate */}
          {!loading && !hasConnection ? (
            <ConnectionGate hasBluesky={hasBluesky} hasFarcaster={hasFarcaster} />
          ) : (
            <>
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
                {/* Manual Refresh Button - Icon only on mobile */}
                <button
                  onClick={() => loadFeed(true)}
                  disabled={refreshing}
                  className="p-3 md:px-4 md:py-3 bg-white/5 hover:bg-white/10 rounded-full font-medium transition-all disabled:opacity-50 border border-white/10 flex items-center gap-2"
                  title="Refresh feed"
                >
                  <FiRefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">Refresh</span>
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

          {/* Sort and Filter Selectors - Compact on mobile */}
          {!showBookmarks && (
            <>
              <div className="flex items-center gap-2 md:gap-3 mb-4">
                <span className="hidden sm:inline text-sm text-gray-400">Sort by:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy("engagement")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      sortBy === "engagement"
                        ? "bg-[#EB83EA] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="hidden sm:inline">Trending</span>
                    <span className="sm:hidden">🔥</span>
                  </button>
                  <button
                    onClick={() => setSortBy("recent")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      sortBy === "recent"
                        ? "bg-[#EB83EA] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="hidden sm:inline">Recent</span>
                    <span className="sm:hidden">🕐</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 mb-6">
                <span className="hidden sm:inline text-sm text-gray-400">Show:</span>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setContentFilter("all")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      contentFilter === "all"
                        ? "bg-[#EB83EA] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    All Content
                  </button>
                  <button
                    onClick={() => setContentFilter("dragverse")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      contentFilter === "dragverse"
                        ? "bg-purple-500 text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    Dragverse Only
                  </button>
                  <button
                    onClick={() => setContentFilter("youtube")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      contentFilter === "youtube"
                        ? "bg-red-500 text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    YouTube
                  </button>
                  <button
                    onClick={() => setContentFilter("bluesky")}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${
                      contentFilter === "bluesky"
                        ? "bg-blue-500 text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    Bluesky
                  </button>
                </div>
              </div>
            </>
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
              {/* Dragverse Native Posts - Use BlueskyPostCard for audio player support */}
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
                      creator: post.creator ? {
                        displayName: post.creator.display_name || post.creator.displayName,
                        handle: post.creator.handle,
                        avatar: post.creator.avatar,
                        did: post.creator.did,
                        blueskyHandle: post.creator.blueskyHandle,
                        farcasterHandle: post.creator.farcasterHandle,
                      } : post.creator,
                    }}
                  />
                ))}

              {/* External Posts (Bluesky, YouTube, etc.) */}
              {posts
                .filter((post) => {
                  if (contentFilter === "all") return true;
                  if (contentFilter === "youtube") return (post as any).source === "youtube";
                  if (contentFilter === "bluesky") return (post as any).source !== "youtube" && (post as any).source !== "dragverse" && (post as any).source !== "ceramic";
                  if (contentFilter === "dragverse") return false; // External posts are not Dragverse
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
              }).length === 0 && !searchError && (
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
          </>
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
