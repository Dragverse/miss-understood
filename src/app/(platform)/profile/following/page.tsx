"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiUsers, FiVideo, FiCheck, FiSearch, FiFilter, FiStar, FiCalendar, FiActivity, FiArrowLeft, FiHeart, FiUserCheck } from "react-icons/fi";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { LoadingShimmer } from "@/components/shared";
import toast from "react-hot-toast";

// Custom loading card component that matches creator card layout
function CreatorLoadingCard() {
  return (
    <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl overflow-hidden border-2 border-[#EB83EA]/10 animate-pulse">
      {/* Banner shimmer */}
      <div className="w-full h-32 bg-[#2f2942]/40" />

      {/* Avatar shimmer */}
      <div className="relative px-6 -mt-12 mb-4">
        <div className="w-24 h-24 rounded-2xl border-4 border-[#18122D] bg-[#2f2942]/40" />
      </div>

      {/* Creator info shimmer */}
      <div className="px-6 pb-6">
        {/* Name shimmer */}
        <div className="h-7 bg-[#2f2942]/40 rounded w-2/3 mb-2" />
        {/* Handle shimmer */}
        <div className="h-4 bg-[#2f2942]/40 rounded w-1/2 mb-4" />
        {/* Description shimmer */}
        <div className="h-4 bg-[#2f2942]/40 rounded w-full mb-2" />
        <div className="h-4 bg-[#2f2942]/40 rounded w-4/5 mb-4" />

        {/* Stats grid shimmer */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#2f2942]/40 rounded-xl p-3">
            <div className="h-3 bg-[#2f2942]/60 rounded w-2/3 mb-2" />
            <div className="h-6 bg-[#2f2942]/60 rounded w-1/2" />
          </div>
          <div className="bg-[#2f2942]/40 rounded-xl p-3">
            <div className="h-3 bg-[#2f2942]/60 rounded w-2/3 mb-2" />
            <div className="h-6 bg-[#2f2942]/60 rounded w-1/2" />
          </div>
        </div>

        {/* Button shimmer */}
        <div className="h-10 bg-[#2f2942]/40 rounded-xl w-full" />
      </div>
    </div>
  );
}

interface CreatorStats {
  followers: number;
  dragverseFollowers: number;
  following: number;
  videos: number;
  totalViews: number;
  totalLikes: number;
  daysSinceJoin: number;
  isNew: boolean;
  videosPerMonth: number;
  accountAgeMonths: number;
}

interface Creator {
  id?: string;
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  banner?: string;
  description?: string;
  verified: boolean;
  stats: CreatorStats;
  social: {
    bluesky?: string;
    farcaster?: string;
  };
  blueskyHandle?: string;
  farcasterHandle?: string;
  joinedAt: string;
}

export default function FollowingPage() {
  const router = useRouter();
  const { user, authenticated, getAccessToken } = usePrivy();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [unfollowingDID, setUnfollowingDID] = useState<string | null>(null);

  // Handle unfollow action
  const handleUnfollow = async (creatorDID: string, creatorName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to profile

    if (!authenticated || !user?.id) {
      toast.error("Please sign in to unfollow");
      return;
    }

    setUnfollowingDID(creatorDID);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/social/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          followingDID: creatorDID,
          action: "unfollow",
        }),
      });

      if (response.ok) {
        // Remove from local state immediately
        setCreators(prevCreators => prevCreators.filter(c => c.did !== creatorDID));
        toast.success(`Unfollowed ${creatorName}`);

        // Trigger event to update counts elsewhere
        window.dispatchEvent(new CustomEvent('followStateChanged', {
          detail: { action: 'unfollow' }
        }));
      } else {
        toast.error("Failed to unfollow");
      }
    } catch (error) {
      console.error("Unfollow error:", error);
      toast.error("Failed to unfollow");
    } finally {
      setUnfollowingDID(null);
    }
  };

  // Format account age in human-readable format
  const formatAccountAge = (months: number): string => {
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0
        ? `${years}y ${remainingMonths}mo`
        : `${years}y`;
    }
    return `${months}mo`;
  };

  // Format videos per month with precision
  const formatVideosPerMonth = (rate: number): string => {
    if (rate >= 10) return Math.round(rate).toString();
    if (rate >= 1) return rate.toFixed(1);
    return rate.toFixed(2);
  };

  useEffect(() => {
    loadFollowing();
  }, [authenticated, user?.id]);

  async function loadFollowing() {
    if (!authenticated || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/social/following/list", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        setCreators(data.creators || []);
      }
    } catch (error) {
      console.error("Failed to load following:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter creators based on search and filters
  const filteredCreators = creators.filter((creator) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        creator.displayName.toLowerCase().includes(query) ||
        creator.handle.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Verified filter
    if (showVerifiedOnly && !creator.verified) {
      return false;
    }

    // New creators filter
    if (showNewOnly && !creator.stats.isNew) {
      return false;
    }

    return true;
  });

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#EB83EA]/30">
            <FiUsers className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Sign in to view your following</h1>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect with your favorite drag artists and stay updated with their latest content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Profile
          </button>

          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiHeart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Following
              </h1>
              <p className="text-gray-400 text-sm">
                {filteredCreators.length} {filteredCreators.length === 1 ? "creator" : "creators"} you're following on Dragverse
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
                  className="w-full pl-12 pr-4 py-3 bg-[#2f2942] border-2 border-[#EB83EA]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA]/40 transition-all"
                />
              </div>
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
              <CreatorLoadingCard key={i} />
            ))}
          </div>
        ) : filteredCreators.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-3xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-6">
              <FiUsers className="w-12 h-12 text-gray-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              {searchQuery || showVerifiedOnly || showNewOnly
                ? "No Creators Found"
                : "Not Following Anyone Yet"}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || showVerifiedOnly || showNewOnly
                ? "Try adjusting your search or filters"
                : "Discover amazing drag artists to follow"}
            </p>
            {!searchQuery && !showVerifiedOnly && !showNewOnly && (
              <button
                onClick={() => router.push("/creators")}
                className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
              >
                Discover Creators
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreators.map((creator) => (
              <div
                key={creator.did}
                className="group bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl overflow-hidden border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all hover:shadow-lg hover:shadow-[#EB83EA]/20"
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
                    <VerificationBadge
                      badgeType={getUserBadgeType(
                        creator.did,
                        undefined,
                        !!creator.blueskyHandle,
                        !!creator.farcasterHandle
                      )}
                      size={20}
                      className="flex-shrink-0"
                    />
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
                    <div className="flex flex-col items-center p-3 bg-[#2f2942] rounded-xl border border-[#EB83EA]/10">
                      <FiCalendar className="w-4 h-4 text-[#EB83EA] mb-1" />
                      <span className="font-bold text-white text-lg">
                        {formatAccountAge(creator.stats.accountAgeMonths)}
                      </span>
                      <span className="text-xs text-gray-400">Active</span>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-[#2f2942] rounded-xl border border-[#EB83EA]/10">
                      <FiActivity className="w-4 h-4 text-[#EB83EA] mb-1" />
                      <span className="font-bold text-white text-lg">
                        {formatVideosPerMonth(creator.stats.videosPerMonth)}
                      </span>
                      <span className="text-xs text-gray-400">Videos/mo</span>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-white/5 rounded-xl">
                      <FiVideo className="w-4 h-4 text-gray-400 mb-1" />
                      <span className="font-semibold text-white">
                        {creator.stats.videos}
                      </span>
                      <span className="text-xs text-gray-500">Videos</span>
                    </div>

                    <div className="flex flex-col items-center p-3 bg-white/5 rounded-xl">
                      <FiUsers className="w-4 h-4 text-gray-400 mb-1" />
                      <span className="font-semibold text-white">
                        {creator.stats.dragverseFollowers >= 1000
                          ? `${(creator.stats.dragverseFollowers / 1000).toFixed(1)}k`
                          : creator.stats.dragverseFollowers}
                      </span>
                      <span className="text-xs text-gray-500">Followers</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => router.push(`/u/${creator.handle}`)}
                      className="px-4 py-2 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={(e) => handleUnfollow(creator.did, creator.displayName, e)}
                      disabled={unfollowingDID === creator.did}
                      className="px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {unfollowingDID === creator.did ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <FiUserCheck className="w-4 h-4" />
                          <span>Following</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
