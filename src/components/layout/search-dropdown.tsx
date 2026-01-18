"use client";

import { useState, useEffect, useRef } from "react";
import { FiSearch, FiUser, FiHash, FiMessageSquare } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SearchResult {
  users: Array<{
    did: string;
    handle: string;
    displayName: string;
    avatar: string;
    description: string;
    followerCount: number;
    source?: string; // Deprecated: use sources array instead
    sources?: string[]; // Array of platforms: ["dragverse", "bluesky"]
    dragverseFollowerCount?: number;
    blueskyFollowerCount?: number;
  }>;
  posts: Array<{
    id: string;
    text: string;
    author: {
      handle: string;
      displayName: string;
      avatar: string;
    };
    source: string;
    externalUrl?: string;
  }>;
  hashtags: Array<{
    tag: string;
    source: string;
    postCount: number;
  }>;
}

export function SearchDropdown() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    async function search() {
      if (debouncedQuery.trim().length < 2) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
        const data = await response.json();

        if (data.success) {
          setResults(data.results);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    search();
  }, [debouncedQuery]);

  const hasResults = results && (results.users.length > 0 || results.posts.length > 0 || results.hashtags.length > 0);

  return (
    <div className="relative flex-1 max-w-xl" ref={dropdownRef}>
      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search for users, posts, or hashtags"
          className="w-full bg-white/5 border border-transparent focus:border-[#EB83EA]/30 rounded-full py-2.5 px-6 pl-12 text-sm transition-all outline-none placeholder:text-gray-500"
        />
      </div>

      {/* Results Dropdown */}
      {isOpen && hasResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-2xl max-h-[500px] overflow-y-auto z-50">
          {/* Users */}
          {results.users.length > 0 && (
            <div className="p-3">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                <FiUser className="w-4 h-4" />
                Users
              </div>
              {results.users.slice(0, 5).map((user) => (
                <Link
                  key={user.did}
                  href={`/profile/${user.handle}`}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition"
                >
                  <Image
                    src={user.avatar}
                    alt={user.displayName}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      @{user.handle} • {user.followerCount} followers
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(user.sources?.includes("dragverse") || user.source === "dragverse") && (
                      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                        Dragverse
                      </span>
                    )}
                    {(user.sources?.includes("bluesky") || user.source === "bluesky") && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                        Bluesky
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Hashtags */}
          {results.hashtags.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                <FiHash className="w-4 h-4" />
                Hashtags
              </div>
              {results.hashtags.slice(0, 5).map((hashtag) => (
                <Link
                  key={hashtag.tag}
                  href={`/search?q=${encodeURIComponent(hashtag.tag)}`}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition"
                >
                  <span className="text-sm text-[#EB83EA] font-medium">
                    {hashtag.tag}
                  </span>
                  <span className="text-xs text-gray-400">
                    {hashtag.postCount} posts
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                <FiMessageSquare className="w-4 h-4" />
                Posts
              </div>
              {results.posts.slice(0, 3).map((post) => (
                <a
                  key={post.id}
                  href={post.externalUrl || "#"}
                  target={post.externalUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="block px-3 py-2.5 rounded-xl hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Image
                      src={post.author.avatar}
                      alt={post.author.displayName}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <span className="text-xs font-semibold text-gray-300">
                      {post.author.displayName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 line-clamp-2">
                    {post.text}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isOpen && isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-2xl p-6 text-center z-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#EB83EA] mx-auto"></div>
        </div>
      )}

      {/* No Results */}
      {isOpen && !isLoading && !hasResults && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-2xl p-6 text-center z-50">
          <p className="text-sm text-gray-400">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
