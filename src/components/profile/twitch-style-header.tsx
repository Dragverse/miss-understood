/**
 * Twitch-Style Profile Header
 *
 * Modern social-app profile layout with:
 * - Livestream area at top (prepared for future integration)
 * - Consolidated stats and social links
 * - Share profile button
 * - Clean, compact design
 */

import Image from "next/image";
import { FiEdit2, FiShare2, FiCheck, FiPlayCircle, FiUsers, FiVideo, FiEye, FiHeart } from "react-icons/fi";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";
import { Creator, Video } from "@/types";

interface TwitchStyleHeaderProps {
  creator: Creator;
  stats: {
    totalViews: number;
    totalLikes: number;
    videoCount: number;
  };
  aggregatedStats?: {
    totalFollowers: number;
    dragverseFollowers: number;
    blueskyFollowers: number;
    youtubeSubscribers: number;
  } | null;
  userVideos: Video[];
  onEditProfile: () => void;
  onShareProfile: () => void;
  shareSuccess: boolean;
}

export function TwitchStyleHeader({
  creator,
  stats,
  aggregatedStats,
  userVideos,
  onEditProfile,
  onShareProfile,
  shareSuccess,
}: TwitchStyleHeaderProps) {
  return (
    <div>
      {/* LIVESTREAM AREA - Prepared for future Twitch-style integration */}
      <div className="relative w-full bg-gradient-to-br from-[#18122D] to-[#0a0415] border-b-2 border-[#EB83EA]/10">
        {/* Banner as background when offline */}
        {creator.banner && (
          <div className="absolute inset-0 opacity-20">
            <Image
              src={creator.banner}
              alt="banner"
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Livestream Player Area */}
        <div className="aspect-video max-h-[500px] bg-black/40 flex items-center justify-center relative">
          {/* Offline State */}
          <div className="text-center p-8 z-10">
            <div className="w-20 h-20 rounded-full bg-[#2f2942]/60 flex items-center justify-center mx-auto mb-4">
              <FiPlayCircle className="w-10 h-10 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-400 mb-2">Channel Offline</h2>
            <p className="text-gray-500 text-sm">
              {creator.displayName} will appear here when they go live
            </p>
          </div>

          {/* When live, this area will show:
          - <div className="absolute top-4 left-4 px-4 py-2 bg-red-600 ...">LIVE</div>
          - <div className="absolute top-4 right-4 ...">Viewer Count</div>
          - Video player component
          */}
        </div>
      </div>

      {/* CONSOLIDATED PROFILE HEADER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Avatar */}
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
          <div className="flex-1 min-w-0">
            {/* Name & Handle */}
            <div className="mb-4">
              <h1 className="text-3xl lg:text-4xl font-bold mb-1 truncate">
                {creator.displayName}
              </h1>
              <p className="text-[#EB83EA] text-lg font-medium">@{creator.handle}</p>
            </div>

            {/* Stats Row - Compact & Inline */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center flex-shrink-0">
                  <FiUsers className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {aggregatedStats
                      ? aggregatedStats.totalFollowers.toLocaleString()
                      : creator.followerCount.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs leading-tight">Followers</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center flex-shrink-0">
                  <FiVideo className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">{stats.videoCount}</p>
                  <p className="text-gray-500 text-xs leading-tight">Videos</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center flex-shrink-0">
                  <FiEye className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {stats.totalViews.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs leading-tight">Views</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EB83EA]/20 flex items-center justify-center flex-shrink-0">
                  <FiHeart className="w-4 h-4 text-[#EB83EA]" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {stats.totalLikes.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs leading-tight">Hearts</p>
                </div>
              </div>
            </div>

            {/* Social Links - Inline & Compact */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
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
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#FF0000] to-[#CC0000] text-white text-sm font-semibold rounded-lg"
                  title="YouTube Connected"
                >
                  <FaYoutube className="w-4 h-4" />
                  <span className="hidden sm:inline">YouTube</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {creator.description && (
              <p className="text-gray-300 leading-relaxed line-clamp-3">
                {creator.description}
              </p>
            )}
          </div>

          {/* RIGHT: Action Buttons */}
          <div className="flex lg:flex-col gap-2">
            <button
              onClick={onEditProfile}
              className="flex-1 lg:flex-none px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-lg transition-all flex items-center gap-2 justify-center whitespace-nowrap"
            >
              <FiEdit2 className="w-5 h-5" />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
            <button
              onClick={onShareProfile}
              className="flex-1 lg:flex-none px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-lg transition-all flex items-center gap-2 justify-center whitespace-nowrap"
            >
              {shareSuccess ? (
                <>
                  <FiCheck className="w-5 h-5" />
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <FiShare2 className="w-5 h-5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
