"use client";

import { Suspense, useState, useEffect } from "react";
import { FiZap, FiPlus } from "react-icons/fi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/lib/privy/hooks";
import { PostCard as BlueskyPostCard } from "@/components/feed/post-card";
import { PostCard } from "@/components/posts/post-card";
import { PostComposer } from "@/components/posts/post-composer";
import { FeedRightSidebar } from "@/components/feed/feed-right-sidebar";

function FeedContent() {
  const { isAuthenticated } = useAuthUser();
  const searchParams = useSearchParams();
  const filter = searchParams?.get("filter");
  const hashtag = searchParams?.get("hashtag");
  const showBookmarks = filter === "bookmarks";

  const [posts, setPosts] = useState<any[]>([]);
  const [dragversePosts, setDragversePosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBluesky, setHasBluesky] = useState(false);
  const [sortBy, setSortBy] = useState<"engagement" | "recent">("engagement");
  const [showComposer, setShowComposer] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Check Bluesky session status
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

    if (isAuthenticated) {
      checkBlueskySession();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      setSearchError(null);
      try {
        // Fetch from all sources in parallel for maximum content diversity
        const [dragverseRes, blueskyRes, youtubeRes] = await Promise.all([
          // Native Dragverse posts
          fetch("/api/posts/feed?limit=50").catch(() => null),

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
        if (dragverseRes?.ok) {
          const dragverseData = await dragverseRes.json();
          setDragversePosts(dragverseData.posts || []);
        }

        // Parse Bluesky and YouTube content
        let allPosts: any[] = [];

        if (blueskyRes?.ok) {
          const blueskyData = await blueskyRes.json();
          if (blueskyData.error) {
            setSearchError(blueskyData.error);
          } else {
            // Bluesky posts already have the correct structure from blueskyPostToContent/blueskyPostToVideo
            allPosts = [...allPosts, ...(blueskyData.posts || [])];
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
              // Add post-like properties for BlueskyPostCard compatibility
              author: video.creator,
              uri: video.externalUrl,
              indexedAt: video.createdAt,
              // Ensure playbackUrl is set correctly
              playbackUrl: video.playbackUrl || video.externalUrl,
            }));
            allPosts = [...allPosts, ...youtubePosts];
          }
        }

        // Sort combined posts by date (newest first)
        allPosts.sort((a, b) => {
          const aDate = new Date(a.createdAt || a.indexedAt).getTime();
          const bDate = new Date(b.createdAt || b.indexedAt).getTime();
          return bDate - aDate;
        });

        // Filter by bookmarks if needed
        if (showBookmarks) {
          const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
          allPosts = allPosts.filter((post: any) => bookmarks.includes(post.id));
        }

        setPosts(allPosts);
      } catch (error) {
        console.error("Failed to load feed:", error);
        setSearchError(error instanceof Error ? error.message : "Failed to load feed");
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [sortBy, showBookmarks, hashtag]);

  const handlePostCreated = () => {
    // Reload Dragverse posts
    fetch("/api/posts/feed?limit=50")
      .then((res) => res.json())
      .then((data) => setDragversePosts(data.posts || []))
      .catch((error) => console.error("Failed to reload posts:", error));

    setShowComposer(false);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <FiZap className="w-10 h-10 text-[#EB83EA]" />
                <h1 className="font-bold text-3xl lg:text-4xl uppercase tracking-widest">
                  {showBookmarks
                    ? "Your Bookmarks"
                    : hashtag
                    ? hashtag
                    : "What's Happening Backstage"}
                </h1>
              </div>
              {isAuthenticated && !showBookmarks && (
                <button
                  onClick={() => setShowComposer(!showComposer)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold transition-all shadow-lg shadow-[#EB83EA]/30"
                >
                  <FiPlus className="w-5 h-5" />
                  {showComposer ? "Cancel" : "Share Your Story"}
                </button>
              )}
            </div>
            <p className="text-gray-400 text-sm ml-14">
              {showBookmarks
                ? "Posts you've saved to read later"
                : hashtag
                ? `Posts tagged with ${hashtag}`
                : "The latest tea, looks, and moments from your favorite queens"}
            </p>
          </div>

          {/* Post Composer */}
          {showComposer && isAuthenticated && (
            <div className="mb-8">
              <PostComposer onPostCreated={handlePostCreated} />
            </div>
          )}

          {/* Sort Selector */}
          {!showBookmarks && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-gray-400">Sort by:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy("engagement")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    sortBy === "engagement"
                      ? "bg-[#EB83EA] text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  Trending
                </button>
                <button
                  onClick={() => setSortBy("recent")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    sortBy === "recent"
                      ? "bg-[#EB83EA] text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  Recent
                </button>
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
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EB83EA]"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dragverse Native Posts */}
              {dragversePosts.map((post) => (
                <PostCard key={`dragverse-${post.id}`} post={post} />
              ))}

              {/* Bluesky Posts */}
              {posts.map((post) => (
                <BlueskyPostCard key={`bluesky-${post.id}`} post={post} />
              ))}

              {dragversePosts.length === 0 && posts.length === 0 && !searchError && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center">
                    <FiZap className="w-10 h-10 text-[#EB83EA]" />
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
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EB83EA]"></div>
            </div>
          </div>
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}
