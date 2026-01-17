"use client";

import { Suspense, useState, useEffect } from "react";
import { FiZap, FiPlus } from "react-icons/fi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/lib/privy/hooks";
import { PostCard } from "@/components/feed/post-card";
import { FeedRightSidebar } from "@/components/feed/feed-right-sidebar";

function FeedContent() {
  const { isAuthenticated } = useAuthUser();
  const searchParams = useSearchParams();
  const filter = searchParams?.get("filter");
  const showBookmarks = filter === "bookmarks";

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBluesky, setHasBluesky] = useState(false);
  const [sortBy, setSortBy] = useState<"engagement" | "recent">("engagement");

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
      try {
        const response = await fetch(`/api/bluesky/feed?limit=30&sortBy=${sortBy}`);
        const data = await response.json();

        // Filter for text/photo posts only (exclude videos)
        // Videos have playbackUrl with .m3u8 or are from external video platforms
        const feedPosts = (data.posts || []).filter((post: any) => {
          const hasVideoPlayback = post.playbackUrl?.includes("m3u8");
          const hasExternalVideo =
            post.playbackUrl?.includes("youtube") ||
            post.playbackUrl?.includes("youtu.be") ||
            post.playbackUrl?.includes("vimeo") ||
            post.playbackUrl?.includes("tiktok");

          return !hasVideoPlayback && !hasExternalVideo;
        });

        // Filter by bookmarks if needed
        if (showBookmarks) {
          const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
          const bookmarkedPosts = feedPosts.filter((post: any) =>
            bookmarks.includes(post.id)
          );
          setPosts(bookmarkedPosts);
        } else {
          setPosts(feedPosts);
        }
      } catch (error) {
        console.error("Failed to load feed:", error);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [sortBy, showBookmarks]);

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
                  {showBookmarks ? "Your Bookmarks" : "What's Happening Backstage"}
                </h1>
              </div>
              {hasBluesky && !showBookmarks && (
                <Link
                  href="/feed/create"
                  className="flex items-center gap-2 px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-full font-semibold transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  Create Post
                </Link>
              )}
            </div>
            <p className="text-gray-400 text-sm ml-14">
              {showBookmarks
                ? "Posts you've saved to read later"
                : "The latest tea, looks, and moments from your favorite queens"}
            </p>
          </div>

          {/* Bluesky Connection Warning */}
          {isAuthenticated && !hasBluesky && !showBookmarks && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-300">
                <Link
                  href="/settings"
                  className="font-semibold underline hover:text-blue-200 transition"
                >
                  Connect your Bluesky account
                </Link>{" "}
                in Settings to create posts and interact with the community.
              </p>
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

          {/* Posts Feed */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EB83EA]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {posts.length === 0 && (
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
