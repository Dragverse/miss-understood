"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiZap, FiTrendingUp, FiBookmark, FiUpload, FiVideo, FiAlertTriangle } from "react-icons/fi";
import { useAuthUser } from "@/lib/privy/hooks";

interface TrendingTopic {
  hashtag: string;
  postCount: number;
  estimatedTotal: number;
}

export function FeedRightSidebar() {
  const { creator } = useAuthUser();
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLivestreamApproved, setIsLivestreamApproved] = useState(false);

  useEffect(() => {
    const updateBookmarkCount = () => {
      const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
      setBookmarkCount(bookmarks.length);
    };

    // Initial count
    updateBookmarkCount();

    // Listen for storage changes
    window.addEventListener("storage", updateBookmarkCount);
    return () => window.removeEventListener("storage", updateBookmarkCount);
  }, []);

  // Check if user is approved for livestreaming
  useEffect(() => {
    async function checkLivestreamApproval() {
      if (!creator?.did) return;

      try {
        const response = await fetch(`/api/creators/${creator.did}/livestream-status`);
        const data = await response.json();
        setIsLivestreamApproved(data.approved || false);
      } catch (error) {
        console.error("Failed to check livestream approval:", error);
      }
    }
    checkLivestreamApproval();
  }, [creator]);

  // Fetch trending hashtags from Bluesky
  useEffect(() => {
    async function loadTrending() {
      try {
        const response = await fetch("/api/bluesky/trending");
        const data = await response.json();
        if (data.success && data.trending) {
          setTrendingTopics(data.trending);
        }
      } catch (error) {
        console.error("Failed to load trending topics:", error);
        // Use fallback data
        setTrendingTopics([
          { hashtag: "#DragCon2026", postCount: 820, estimatedTotal: 8200 },
          { hashtag: "#MakeupTutorial", postCount: 570, estimatedTotal: 5700 },
          { hashtag: "#LipSyncBattle", postCount: 410, estimatedTotal: 4100 },
        ]);
      }
    }
    loadTrending();
  }, []);

  return (
    <aside className="space-y-6 sticky top-6">
      {/* Beta Warning */}
      <div className="relative p-6 rounded-[24px] bg-gradient-to-br from-purple-600/20 via-purple-700/15 to-purple-900/20 border-2 border-purple-500/40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-purple-500/20">
              <FiAlertTriangle className="w-5 h-5 text-yellow-300" />
            </div>
            <span className="font-heading text-xl font-black text-white uppercase tracking-wider">
              Beta Warning
            </span>
          </div>
          <p className="text-sm text-purple-100 leading-relaxed">
            Dragverse is in active development. Please be aware some features might not be working correctly.
          </p>
        </div>
      </div>

      {/* Upload Video or Audio */}
      <Link
        href="/feed/create"
        className="block p-6 rounded-[24px] bg-gradient-to-br from-[#7c3aed]/20 to-[#6b2fd5]/20 border-2 border-[#7c3aed]/40 hover:border-[#7c3aed]/70 transition-all group shadow-lg hover:shadow-[#7c3aed]/20"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-full bg-[#7c3aed]/30">
            <FiUpload className="w-5 h-5 text-[#c4b5fd]" />
          </div>
          <h3 className="font-heading text-lg font-black uppercase tracking-wide text-white">
            Upload Video or Audio
          </h3>
        </div>
        <p className="text-sm text-purple-200 leading-relaxed">
          Share your latest performances, tutorials, and behind-the-scenes content.
        </p>
      </Link>

      {/* Go Live - Only for approved users */}
      {isLivestreamApproved && (
        <Link
          href="/livestream"
          className="block p-6 rounded-[24px] bg-gradient-to-br from-red-500/20 to-pink-500/20 border-2 border-red-500/40 hover:border-red-500/70 transition-all group shadow-lg hover:shadow-red-500/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-red-500/30">
              <FiVideo className="w-5 h-5 text-red-300" />
            </div>
            <h3 className="font-heading text-lg font-black uppercase tracking-wide text-white">
              Go Live
            </h3>
          </div>
          <p className="text-sm text-red-200 leading-relaxed">
            Start a livestream and connect with your audience in real-time.
          </p>
        </Link>
      )}

      {/* Your Bookmarks */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border-2 border-[#2f2942] shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-[#EB83EA]/20">
            <FiBookmark className="w-5 h-5 text-[#EB83EA]" />
          </div>
          <h3 className="font-heading text-lg font-black uppercase tracking-wide">Your Bookmarks</h3>
        </div>
        {bookmarkCount > 0 ? (
          <div className="text-center">
            <p className="text-2xl font-bold text-[#EB83EA] mb-2">
              {bookmarkCount}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Saved posts
            </p>
            <Link
              href="/feed?filter=bookmarks"
              className="block w-full py-2.5 bg-[#EB83EA] hover:bg-[#E748E6] rounded-full font-bold text-sm text-center transition uppercase tracking-wider"
            >
              View All
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#EB83EA]/10 flex items-center justify-center">
              <FiBookmark className="w-6 h-6 text-[#EB83EA]" />
            </div>
            <p className="text-sm text-gray-400">
              Save posts to read later
            </p>
          </div>
        )}
      </div>

      {/* Trending Topics */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border-2 border-[#2f2942] shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-[#E748E6]/20">
            <FiTrendingUp className="w-5 h-5 text-[#E748E6]" />
          </div>
          <h3 className="font-heading text-lg font-black uppercase tracking-wide">The Tea</h3>
        </div>
        <div className="space-y-3">
          {trendingTopics.length > 0 ? (
            trendingTopics.map((topic) => (
              <Link
                key={topic.hashtag}
                href={`/feed?hashtag=${encodeURIComponent(topic.hashtag)}`}
                className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition group"
              >
                <p className="font-semibold text-sm text-[#E748E6] group-hover:text-[#EB83EA] transition">
                  {topic.hashtag}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(topic.estimatedTotal / 1000).toFixed(1)}K posts
                </p>
              </Link>
            ))
          ) : (
            <>
              <Link
                href="/feed?hashtag=%23DragCon2026"
                className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition group"
              >
                <p className="font-semibold text-sm text-[#E748E6] group-hover:text-[#EB83EA] transition">
                  #DragCon2026
                </p>
                <p className="text-xs text-gray-400 mt-1">8.2K posts</p>
              </Link>
              <Link
                href="/feed?hashtag=%23MakeupTutorial"
                className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition group"
              >
                <p className="font-semibold text-sm text-[#E748E6] group-hover:text-[#EB83EA] transition">
                  #MakeupTutorial
                </p>
                <p className="text-xs text-gray-400 mt-1">5.7K posts</p>
              </Link>
              <Link
                href="/feed?hashtag=%23LipSyncBattle"
                className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition group"
              >
                <p className="font-semibold text-sm text-[#E748E6] group-hover:text-[#EB83EA] transition">
                  #LipSyncBattle
                </p>
                <p className="text-xs text-gray-400 mt-1">4.1K posts</p>
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
