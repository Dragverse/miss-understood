"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiStar, FiUsers, FiZap, FiTrendingUp, FiBookmark } from "react-icons/fi";

interface StarterPack {
  name: string;
  description: string;
  memberCount: number;
  image: string;
  url: string;
}

interface FeaturedList {
  name: string;
  description: string;
  creatorCount: number;
  url: string;
}

interface TrendingTopic {
  hashtag: string;
  postCount: number;
  estimatedTotal: number;
}

const STARTER_PACKS: StarterPack[] = [
  {
    name: "Drag Race Royalty",
    description: "Follow all your favorite Ru girls",
    memberCount: 150,
    image: "https://api.dicebear.com/9.x/shapes/svg?seed=dragrace",
    url: "https://bsky.app/starter-pack/dragrace",
  },
  {
    name: "Rising Stars",
    description: "Emerging drag talent to watch",
    memberCount: 89,
    image: "https://api.dicebear.com/9.x/shapes/svg?seed=rising",
    url: "https://bsky.app/starter-pack/rising",
  },
];

const FEATURED_LISTS: FeaturedList[] = [
  {
    name: "Legendary Queens",
    description: "The icons who paved the way",
    creatorCount: 42,
    url: "#",
  },
  {
    name: "Makeup Artists",
    description: "Beauty tutorials & transformations",
    creatorCount: 67,
    url: "#",
  },
  {
    name: "Performance Artists",
    description: "Live shows, lip syncs, dance",
    creatorCount: 58,
    url: "#",
  },
];

export function FeedRightSidebar() {
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [starterPacks, setStarterPacks] = useState<StarterPack[]>(STARTER_PACKS);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);

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

  // Fetch real starter packs from Bluesky
  useEffect(() => {
    async function loadStarterPacks() {
      try {
        const response = await fetch("/api/bluesky/starter-packs");
        const data = await response.json();
        if (data.success && data.starterPacks) {
          setStarterPacks(data.starterPacks);
        }
      } catch (error) {
        console.error("Failed to load starter packs:", error);
      }
    }
    loadStarterPacks();
  }, []);

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
    <aside className="space-y-6">
      {/* Backstage Pass - Featured Story */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/10 border border-[#EB83EA]/30">
        <div className="flex items-center gap-3 mb-3">
          <FiZap className="w-5 h-5 text-[#EB83EA]" />
          <h3 className="font-bold text-lg">Backstage Pass</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Get exclusive behind-the-scenes moments from your favorite queens. Join the conversation!
        </p>
        <Link
          href="/shorts"
          className="block w-full py-2.5 bg-[#EB83EA] hover:bg-[#E748E6] rounded-full font-bold text-sm text-center transition uppercase tracking-wider"
        >
          Watch Now
        </Link>
      </div>

      {/* Starter Packs */}
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <div className="flex items-center gap-3 mb-4">
          <FiStar className="w-5 h-5 text-[#CDB531]" />
          <h3 className="font-bold text-lg">Starter Packs</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          New here? Join these curated communities
        </p>
        <div className="space-y-3">
          {starterPacks.map((pack) => (
            <a
              key={pack.name}
              href={pack.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-[#CDB531]/30 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={pack.image}
                    alt={pack.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm group-hover:text-[#CDB531] transition">
                    {pack.name}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {pack.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {pack.memberCount} members
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Featured Lists */}
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <div className="flex items-center gap-3 mb-4">
          <FiUsers className="w-5 h-5 text-[#815BFF]" />
          <h3 className="font-bold text-lg">Lists & Circles</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Discover creators by category
        </p>
        <div className="space-y-2">
          {FEATURED_LISTS.map((list) => (
            <Link
              key={list.name}
              href={list.url}
              className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-[#815BFF]/30 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm group-hover:text-[#815BFF] transition">
                    {list.name}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {list.description}
                  </p>
                </div>
                <span className="text-xs text-gray-500 ml-2">
                  {list.creatorCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Your Bookmarks */}
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <div className="flex items-center gap-3 mb-4">
          <FiBookmark className="w-5 h-5 text-[#EB83EA]" />
          <h3 className="font-bold text-lg">Your Bookmarks</h3>
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
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <div className="flex items-center gap-3 mb-4">
          <FiTrendingUp className="w-5 h-5 text-[#E748E6]" />
          <h3 className="font-bold text-lg">The Tea</h3>
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
