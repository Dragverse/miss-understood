"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiTrendingUp, FiBookmark, FiUpload, FiVideo, FiAlertTriangle, FiRss, FiList } from "react-icons/fi";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";

interface SavedFeed {
  uri: string;
  displayName: string;
  avatar?: string | null;
}

interface UserList {
  uri: string;
  name: string;
  itemCount: number;
}

interface TrendingTopic {
  hashtag: string;
  postCount: number;
  estimatedTotal: number;
}

const DRAG_FILTER_CHIPS = [
  { label: "Queens", hashtag: "#DragQueen" },
  { label: "Kings", hashtag: "#DragKing" },
  { label: "Ballroom", hashtag: "#Ballroom" },
  { label: "Vogue", hashtag: "#Voguing" },
  { label: "Looks", hashtag: "#DragMakeup" },
  { label: "Dragula", hashtag: "#Dragula" },
  { label: "Queer Art", hashtag: "#QueerArt" },
];

const FALLBACK_TRENDING = [
  { hashtag: "#DragRace", postCount: 820, estimatedTotal: 67240 },
  { hashtag: "#DragQueen", postCount: 750, estimatedTotal: 61500 },
  { hashtag: "#DragMakeup", postCount: 570, estimatedTotal: 46740 },
  { hashtag: "#Ballroom", postCount: 490, estimatedTotal: 40180 },
  { hashtag: "#LipSync", postCount: 410, estimatedTotal: 33620 },
  { hashtag: "#QueerArt", postCount: 380, estimatedTotal: 31160 },
  { hashtag: "#DragKing", postCount: 320, estimatedTotal: 26240 },
  { hashtag: "#Voguing", postCount: 290, estimatedTotal: 23780 },
];

export function FeedRightSidebar() {
  const { creator, isAuthenticated, blueskyConnected } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLivestreamApproved, setIsLivestreamApproved] = useState(false);
  const [savedFeeds, setSavedFeeds] = useState<SavedFeed[]>([]);
  const [userLists, setUserLists] = useState<UserList[]>([]);

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

  // Load saved feeds and lists when Bluesky is connected
  useEffect(() => {
    if (!isAuthenticated || !blueskyConnected) return;

    async function loadBlueskyExtras() {
      try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [feedsRes, listsRes] = await Promise.all([
          fetch("/api/bluesky/saved-feeds", { headers }),
          fetch("/api/bluesky/lists", { headers }),
        ]);

        if (feedsRes.ok) {
          const data = await feedsRes.json();
          setSavedFeeds((data.feeds || []).slice(0, 5));
        }
        if (listsRes.ok) {
          const data = await listsRes.json();
          setUserLists((data.lists || []).slice(0, 5));
        }
      } catch {
        // Non-critical — sidebar extras
      }
    }

    loadBlueskyExtras();
  }, [isAuthenticated, blueskyConnected, getAccessToken]);

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
        href="/upload"
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
          href="/dashboard"
          className="block p-6 rounded-[24px] bg-gradient-to-br from-red-500/20 to-pink-500/20 border-2 border-red-500/40 hover:border-red-500/70 transition-all group shadow-lg hover:shadow-red-500/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-red-500/30">
              <FiVideo className="w-5 h-5 text-red-300" />
            </div>
            <h3 className="font-heading text-lg font-black uppercase tracking-wide text-white">
              Start Streaming
            </h3>
          </div>
          <p className="text-sm text-red-200 leading-relaxed">
            Create and manage your livestreams from your dashboard.
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

      {/* The Tea — Trending Topics */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border-2 border-[#2f2942] shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-[#E748E6]/20">
            <FiTrendingUp className="w-5 h-5 text-[#E748E6]" />
          </div>
          <h3 className="font-heading text-lg font-black uppercase tracking-wide">The Tea</h3>
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {DRAG_FILTER_CHIPS.map((chip) => (
            <Link
              key={chip.label}
              href={`/feed?hashtag=${encodeURIComponent(chip.hashtag)}`}
              className="px-2.5 py-1 rounded-full bg-[#EB83EA]/10 hover:bg-[#EB83EA]/25 border border-[#EB83EA]/20 hover:border-[#EB83EA]/50 text-[#EB83EA] text-[10px] font-bold uppercase tracking-wide transition-all"
            >
              {chip.label}
            </Link>
          ))}
        </div>

        {/* Live trending from Bluesky */}
        <div className="space-y-2">
          {(trendingTopics.length > 0 ? trendingTopics : FALLBACK_TRENDING).map((topic) => (
            <Link
              key={topic.hashtag}
              href={`/feed?hashtag=${encodeURIComponent(topic.hashtag)}`}
              className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition group"
            >
              <p className="font-semibold text-sm text-[#E748E6] group-hover:text-[#EB83EA] transition truncate">
                {topic.hashtag}
              </p>
              <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {topic.estimatedTotal >= 1000
                  ? `${(topic.estimatedTotal / 1000).toFixed(1)}K`
                  : topic.estimatedTotal}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Saved Feeds — Bluesky */}
      {blueskyConnected && savedFeeds.length > 0 && (
        <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border-2 border-[#2f2942] shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-blue-500/20">
              <FiRss className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-heading text-lg font-black uppercase tracking-wide">Saved Feeds</h3>
          </div>
          <div className="space-y-1">
            {savedFeeds.map((feed) => (
              <Link
                key={feed.uri}
                href={`/feed?feedUri=${encodeURIComponent(feed.uri)}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition text-sm text-gray-300 hover:text-white"
              >
                <FiRss className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                <span className="truncate">{feed.displayName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Your Lists — Bluesky */}
      {blueskyConnected && userLists.length > 0 && (
        <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border-2 border-[#2f2942] shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-[#EB83EA]/20">
              <FiList className="w-5 h-5 text-[#EB83EA]" />
            </div>
            <h3 className="font-heading text-lg font-black uppercase tracking-wide">Your Lists</h3>
          </div>
          <div className="space-y-1">
            {userLists.map((list) => (
              <Link
                key={list.uri}
                href={`/feed?listUri=${encodeURIComponent(list.uri)}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition text-sm text-gray-300 hover:text-white"
              >
                <FiList className="w-3.5 h-3.5 flex-shrink-0 text-[#EB83EA]" />
                <span className="truncate">{list.name}</span>
                <span className="ml-auto text-xs text-gray-500">{list.itemCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
