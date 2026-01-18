"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiUsers, FiVideo, FiEye, FiHeart, FiCheck, FiSearch, FiFilter, FiStar } from "react-icons/fi";
import { LoadingShimmer } from "@/components/shared";
import { isVerified } from "@/config/verified-creators";

interface CreatorStats {
  followers: number;
  dragverseFollowers: number;
  blueskyFollowers: number;
  following: number;
  videos: number;
  totalViews: number;
  totalLikes: number;
  daysSinceJoin: number;
  isNew: boolean;
}

interface Creator {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  banner?: string;
  description?: string;
  verified: boolean;
  stats: CreatorStats;
  social: {
    twitter?: string;
    instagram?: string;
    tiktok?: string;
    bluesky?: string;
  };
  joinedAt: string;
}

export default function CreatorsDirectory() {
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"followers" | "views" | "videos" | "recent">("followers");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);

  useEffect(() => {
    loadCreators();
  }, [sortBy, showVerifiedOnly]);

  async function loadCreators() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sortBy", sortBy);
      params.set("limit", "100");
      if (showVerifiedOnly) {
        params.set("verified", "true");
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/creators/directory?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        let filteredCreators = data.creators;

        // Client-side filter for "new" creators
        if (showNewOnly) {
          filteredCreators = filteredCreators.filter((c: Creator) => c.stats.isNew);
        }

        setCreators(filteredCreators);
      }
    } catch (error) {
      console.error("Failed to load creators:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    loadCreators();
  };

  const filteredAndSortedCreators = creators;

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiUsers className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Discover Creators
              </h1>
              <p className="text-gray-400 text-sm">
                {creators.length} fabulous drag artists shining at Dragverse
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search creators by name or handle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-12 pr-4 py-3 bg-[#2f2942] border-2 border-[#EB83EA]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA]/40 transition-all"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full lg:w-48 px-4 py-3 bg-[#2f2942] border-2 border-[#EB83EA]/20 rounded-xl text-white focus:outline-none focus:border-[#EB83EA]/40 transition-all appearance-none cursor-pointer"
              >
                <option value="followers">Most Followers</option>
                <option value="views">Most Views</option>
                <option value="videos">Most Videos</option>
                <option value="recent">Recently Joined</option>
              </select>
              <FiFilter className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                showVerifiedOnly
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#2f2942] text-gray-400 hover:text-white border border-[#EB83EA]/20"
              }`}
            >
              <FiCheck className="w-4 h-4" />
              Verified Only
            </button>
            <button
              onClick={() => setShowNewOnly(!showNewOnly)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                showNewOnly
                  ? "bg-[#EB83EA] text-white"
                  : "bg-[#2f2942] text-gray-400 hover:text-white border border-[#EB83EA]/20"
              }`}
            >
              <FiStar className="w-4 h-4" />
              New Creators
            </button>
          </div>
        </div>

        {/* Creators Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingShimmer key={i} aspectRatio="video" className="h-80" />
            ))}
          </div>
        ) : filteredAndSortedCreators.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-2">No Creators Found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCreators.map((creator) => (
              <div
                key={creator.did}
                onClick={() => router.push(`/profile/${creator.handle}`)}
                className="group bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl overflow-hidden border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all cursor-pointer hover:shadow-lg hover:shadow-[#EB83EA]/20"
              >
                {/* Banner */}
                <div className="relative h-32 bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20">
                  {creator.banner && (
                    <Image
                      src={creator.banner}
                      alt={`${creator.displayName} banner`}
                      fill
                      className="object-cover"
                    />
                  )}
                  {/* New Badge */}
                  {creator.stats.isNew && (
                    <div className="absolute top-3 right-3 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
                      <FiStar className="w-3 h-3" />
                      NEW
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative px-6 -mt-12 mb-4">
                  <div className="relative w-24 h-24 rounded-2xl border-4 border-[#18122D] overflow-hidden shadow-xl">
                    <Image
                      src={creator.avatar || "/placeholder-avatar.png"}
                      alt={creator.displayName}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </div>

                {/* Creator Info */}
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-[#EB83EA] transition-colors truncate">
                      {creator.displayName}
                    </h3>
                    {(creator.verified || isVerified(creator.did)) && (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#CDB531] flex items-center justify-center" title="Verified Creator">
                        <FiStar className="w-3 h-3 text-black font-bold" />
                      </div>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-4">@{creator.handle}</p>

                  {/* Description */}
                  {creator.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {creator.description}
                    </p>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#2f2942]/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <FiUsers className="w-3 h-3" />
                        <span>Followers</span>
                      </div>
                      <div className="text-white font-bold text-lg">
                        {creator.stats.followers.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#2f2942]/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <FiVideo className="w-3 h-3" />
                        <span>Videos</span>
                      </div>
                      <div className="text-white font-bold text-lg">
                        {creator.stats.videos.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#2f2942]/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <FiEye className="w-3 h-3" />
                        <span>Views</span>
                      </div>
                      <div className="text-white font-bold text-lg">
                        {creator.stats.totalViews.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#2f2942]/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <FiHeart className="w-3 h-3" />
                        <span>Likes</span>
                      </div>
                      <div className="text-white font-bold text-lg">
                        {creator.stats.totalLikes.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* View Profile Button */}
                  <button className="w-full px-4 py-2 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
