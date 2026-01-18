"use client";

/**
 * REDESIGNED PROFILE PAGE
 *
 * Modern social-app design with:
 * - Livestream area at top (prepared for future integration)
 * - Consolidated social buttons and stats
 * - Public profile sharing
 * - Twitch-inspired layout
 */

import { useAuthUser } from "@/lib/privy/hooks";
import Image from "next/image";
import { FiUser, FiEdit2, FiLogIn, FiHeart, FiVideo, FiUsers, FiEye, FiShare2, FiCheck, FiPlayCircle } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VideoCard } from "@/components/video/video-card";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { getVideosByCreator } from "@/lib/supabase/videos";
import { Creator, Video } from "@/types";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { LoadingShimmer } from "@/components/shared";
import { usePrivy } from "@privy-io/react-auth";
import { isVerified } from "@/config/verified-creators";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

export default function ProfilePageRedesign() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn, userHandle, userEmail, user, instagramHandle, tiktokHandle } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const [activeTab, setActiveTab] = useState<"videos" | "bytes" | "photos" | "posts">("videos");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    videoCount: 0,
  });
  const [aggregatedStats, setAggregatedStats] = useState<{
    totalFollowers: number;
    totalFollowing: number;
    dragverseFollowers: number;
    blueskyFollowers: number;
    youtubeSubscribers: number;
  } | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  // ... (keep existing useEffect hooks for loading profile, videos, stats)
  // TODO: Copy from original profile page

  /**
   * Share public profile link
   */
  const handleShareProfile = async () => {
    if (!creator) return;

    const profileUrl = `${window.location.origin}/profile/${creator.handle}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${creator.displayName} on Dragverse`,
          text: `Check out ${creator.displayName}'s profile on Dragverse!`,
          url: profileUrl,
        });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  // Loading states
  if (!isReady || (isAuthenticated && isLoadingProfile)) {
    return (
      <div className="min-h-screen">
        <LoadingShimmer className="h-96 mb-6" /> {/* Livestream area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LoadingShimmer className="h-32 mb-4" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center mx-auto mb-6">
            <FiUser className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Sign in to view your profile</h1>
          <p className="text-gray-400 mb-6">
            Create an account to showcase your talent
          </p>
          <button
            onClick={signIn}
            className="px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-full transition-all flex items-center gap-2 mx-auto"
          >
            <FiLogIn className="w-5 h-5" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  const videosList = userVideos.filter(v => v.contentType !== 'short');
  const bytesList = userVideos.filter(v => v.contentType === 'short');

  return (
    <div className="min-h-screen">
      {/* LIVESTREAM AREA - Prepared for future integration */}
      <div className="relative w-full bg-gradient-to-br from-[#18122D] to-[#0a0415] border-b-2 border-[#EB83EA]/10">
        {/* Placeholder for livestream video player */}
        <div className="aspect-video max-h-[500px] bg-black/40 flex items-center justify-center relative">
          {/* Offline State */}
          <div className="text-center p-8">
            <div className="w-20 h-20 rounded-full bg-[#2f2942]/60 flex items-center justify-center mx-auto mb-4">
              <FiPlayCircle className="w-10 h-10 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-400 mb-2">Channel Offline</h2>
            <p className="text-gray-500 text-sm">
              {creator.displayName} will appear here when they go live
            </p>
          </div>

          {/* Live Badge (when streaming) */}
          {/* <div className="absolute top-4 left-4 px-4 py-2 bg-red-600 text-white font-bold text-sm rounded-lg flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white"></div>
            LIVE
          </div> */}

          {/* Viewer Count (when streaming) */}
          {/* <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/80 text-white text-sm font-bold rounded-lg flex items-center gap-2">
            <FiEye className="w-4 h-4" />
            1,234
          </div> */}
        </div>
      </div>

      {/* PROFILE HEADER - Consolidated & Clean */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Avatar & Basic Info */}
          <div className="flex-shrink-0">
            <div className="relative w-32 h-32 rounded-2xl border-4 border-[#EB83EA]/20 overflow-hidden shadow-2xl">
              <Image
                src={creator.avatar}
                alt={creator.displayName}
                fill
                className="object-cover"
              />
              {creator.verified && (
                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#CDB531] border-2 border-white flex items-center justify-center">
                  <FiCheck className="w-5 h-5 text-black font-bold" />
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Name, Stats, Social */}
          <div className="flex-1">
            {/* Name & Handle */}
            <div className="mb-4">
              <h1 className="text-3xl lg:text-4xl font-bold mb-1">
                {creator.displayName}
              </h1>
              <p className="text-[#EB83EA] text-lg font-medium">@{creator.handle}</p>
            </div>

            {/* Stats Row - Compact */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center">
                  <FiUsers className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">
                    {aggregatedStats ? aggregatedStats.totalFollowers.toLocaleString() : creator.followerCount.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">Followers</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center">
                  <FiVideo className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{stats.videoCount}</p>
                  <p className="text-gray-500 text-xs">Videos</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center">
                  <FiEye className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{stats.totalViews.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Views</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center">
                  <FiHeart className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{stats.totalLikes.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Hearts</p>
                </div>
              </div>
            </div>

            {/* Social Links - Inline & Compact */}
            <div className="flex flex-wrap items-center gap-2">
              {creator.instagramHandle && (
                <a
                  href={`https://instagram.com/${creator.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#E1306C] to-[#C13584] hover:from-[#D12963] hover:to-[#B02575] text-white text-sm font-semibold rounded-lg transition-all"
                  title="Instagram"
                >
                  <FaInstagram className="w-4 h-4" />
                  <span className="hidden sm:inline">@{creator.instagramHandle}</span>
                </a>
              )}
              {creator.tiktokHandle && (
                <a
                  href={`https://tiktok.com/@${creator.tiktokHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#000000] to-[#00f2ea] hover:from-[#111111] hover:to-[#00d9d1] text-white text-sm font-semibold rounded-lg transition-all"
                  title="TikTok"
                >
                  <FaTiktok className="w-4 h-4" />
                  <span className="hidden sm:inline">@{creator.tiktokHandle}</span>
                </a>
              )}
              {creator.blueskyHandle && (
                <a
                  href={`https://bsky.app/profile/${creator.blueskyHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#0085ff] to-[#0066cc] hover:from-[#0077ee] hover:to-[#0055bb] text-white text-sm font-semibold rounded-lg transition-all"
                  title="Bluesky"
                >
                  <SiBluesky className="w-4 h-4" />
                  <span className="hidden sm:inline">@{creator.blueskyHandle}</span>
                </a>
              )}
              {userVideos.some(v => v.source === 'youtube') && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#FF0000] to-[#CC0000] text-white text-sm font-semibold rounded-lg"
                  title="YouTube Connected">
                  <FaYoutube className="w-4 h-4" />
                  <span className="hidden sm:inline">YouTube</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {creator.description && (
              <p className="text-gray-300 mt-4 leading-relaxed">
                {creator.description}
              </p>
            )}
          </div>

          {/* RIGHT: Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push("/settings")}
              className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-lg transition-all flex items-center gap-2 justify-center whitespace-nowrap"
            >
              <FiEdit2 className="w-5 h-5" />
              Edit Profile
            </button>
            <button
              onClick={handleShareProfile}
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-lg transition-all flex items-center gap-2 justify-center whitespace-nowrap"
            >
              {shareSuccess ? (
                <>
                  <FiCheck className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <FiShare2 className="w-5 h-5" />
                  Share Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT TABS */}
      <div className="border-b border-[#EB83EA]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("videos")}
              className={`py-4 px-2 font-bold transition whitespace-nowrap border-b-2 ${
                activeTab === "videos"
                  ? "border-[#EB83EA] text-[#EB83EA]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Videos {videosList.length > 0 && `(${videosList.length})`}
            </button>
            <button
              onClick={() => setActiveTab("bytes")}
              className={`py-4 px-2 font-bold transition whitespace-nowrap border-b-2 ${
                activeTab === "bytes"
                  ? "border-[#EB83EA] text-[#EB83EA]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Bytes {bytesList.length > 0 && `(${bytesList.length})`}
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`py-4 px-2 font-bold transition whitespace-nowrap border-b-2 ${
                activeTab === "photos"
                  ? "border-[#EB83EA] text-[#EB83EA]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Photos {userPhotos.length > 0 && `(${userPhotos.length})`}
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`py-4 px-2 font-bold transition whitespace-nowrap border-b-2 ${
                activeTab === "posts"
                  ? "border-[#EB83EA] text-[#EB83EA]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Posts {userPosts.length > 0 && `(${userPosts.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "videos" && (
          <div>
            {videosList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videosList.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                  <FiVideo className="w-10 h-10 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Videos Yet</h3>
                <p className="text-gray-400 mb-6">Start uploading your performances!</p>
                <button
                  onClick={() => router.push("/upload")}
                  className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-lg transition-all"
                >
                  Upload Your First Video
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "bytes" && (
          <div>
            {bytesList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {bytesList.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <h3 className="text-xl font-bold mb-2">No Bytes Yet</h3>
                <p className="text-gray-400">Upload short-form content!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="text-center py-16">
            <p className="text-gray-400">Photos coming soon!</p>
          </div>
        )}

        {activeTab === "posts" && (
          <div className="text-center py-16">
            <p className="text-gray-400">Posts coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
