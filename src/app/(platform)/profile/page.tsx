"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import Image from "next/image";
import { FiUser, FiEdit2, FiLogIn, FiHeart, FiVideo, FiUsers, FiEye, FiStar, FiCalendar, FiGlobe, FiShare2, FiCheck, FiMusic, FiGrid, FiFilm, FiImage, FiMessageSquare, FiInfo, FiZap, FiHeadphones } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VideoCard } from "@/components/video/video-card";
import { BytesSlider } from "@/components/profile/bytes-slider";
import { PhotoViewerModal } from "@/components/modals/photo-viewer-modal";
import { LivestreamEmbed } from "@/components/profile/livestream-embed";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { getVideosByCreator } from "@/lib/supabase/videos";
import { Creator, Video } from "@/types";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { StatsCard, LoadingShimmer } from "@/components/shared";
import { usePrivy } from "@privy-io/react-auth";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn, userHandle, userEmail, user, instagramHandle, tiktokHandle, blueskyProfile: blueskyProfileFromHook } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const [activeTab, setActiveTab] = useState<"videos" | "bytes" | "audio" | "photos" | "posts" | "about">("videos");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [blueskyProfile, setBlueskyProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    videoCount: 0,
    photoCount: 0,
  });
  const [aggregatedStats, setAggregatedStats] = useState<{
    totalFollowers: number;
    totalFollowing: number;
    dragverseFollowers: number;
    blueskyFollowers: number;
    farcasterFollowers: number;
    farcasterFollowing: number;
    youtubeSubscribers: number;
    platforms: {
      dragverse: boolean;
      bluesky: boolean;
      farcaster: boolean;
      youtube: boolean;
    };
  } | null>(null);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [showBytePlayer, setShowBytePlayer] = useState(false);
  const [selectedByteIndex, setSelectedByteIndex] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // Copy profile link to clipboard
  const handleShareProfile = async () => {
    if (!creator) return;

    // Generate profile URL using handle (short URL format)
    const profileUrl = `${window.location.origin}/u/${creator.handle}`;

    try {
      await navigator.clipboard.writeText(profileUrl);
      setProfileLinkCopied(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setProfileLinkCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy profile link:", error);
    }
  };

  // Fetch creator profile
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        const ceramicProfile = await getCreatorByDID(user.id);
        if (ceramicProfile) {
          setCreator(transformSupabaseCreator(ceramicProfile));
          setIsLoadingProfile(false);
          return;
        }
      } catch (error) {
        console.warn("Could not load from Supabase:", error);
      }

      // Fallback to localStorage or Privy data
      const fallbackProfile = localStorage.getItem("dragverse_profile");
      if (fallbackProfile) {
        try {
          const profileData = JSON.parse(fallbackProfile);
          setCreator({
            did: user.id,
            id: `temp-${user.id}`,
            handle: profileData.handle || userHandle || user.id.slice(0, 8),
            displayName: profileData.displayName || "Unnamed Creator",
            description: profileData.description || "",
            avatar: profileData.avatar || user?.twitter?.profilePictureUrl || "/defaultpfp.png",
            banner: profileData.banner,
            website: profileData.website,
            instagramHandle: profileData.instagramHandle || instagramHandle,
            tiktokHandle: profileData.tiktokHandle || tiktokHandle,
            followerCount: 0,
            followingCount: 0,
            createdAt: new Date(user.createdAt || Date.now()),
            verified: false,
          } as Creator);
          setIsLoadingProfile(false);
          return;
        } catch (e) {
          console.error("Failed to parse fallback profile:", e);
        }
      }

      // Use Privy data as initial state
      const displayName = blueskyProfileFromHook?.displayName || user?.twitter?.name || userHandle || userEmail?.split('@')[0] || "Drag Artist";
      const handle = userHandle;
      const avatar = blueskyProfileFromHook?.avatar || user?.twitter?.profilePictureUrl || "/defaultpfp.png";

      setCreator({
        did: user.id,
        handle: handle,
        displayName: displayName,
        avatar: avatar,
        description: blueskyProfileFromHook?.description || "Welcome to my Dragverse profile!",
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date(user.createdAt || Date.now()),
        verified: false,
        instagramHandle: instagramHandle || undefined,
        tiktokHandle: tiktokHandle || undefined,
      });
      setIsLoadingProfile(false);
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated, user?.id]);

  // Sync profile to populate bluesky_handle in database for aggregation
  useEffect(() => {
    async function syncProfile() {
      if (!isAuthenticated || !user?.id) return;

      try {
        const authToken = await getAccessToken();
        await fetch("/api/creator/sync-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        console.log("[Profile] Profile synced for aggregation");
      } catch (error) {
        console.error("[Profile] Failed to sync profile:", error);
      }
    }

    syncProfile();
  }, [isAuthenticated, user?.id, getAccessToken]);

  // Load videos from Supabase using verified user ID
  useEffect(() => {
    async function loadVideos() {
      if (!user?.id) return;

      setLoading(true);
      try {
        // CRITICAL FIX: Get the verified user ID from the backend
        const authToken = await getAccessToken();
        let verifiedUserId = user.id; // Fallback to client ID

        try {
          const meResponse = await fetch("/api/user/me", {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();
            verifiedUserId = meData.userId; // Use the verified ID from JWT
            console.log("✅ Using verified user ID for profile:", verifiedUserId);
          }
        } catch (error) {
          console.error("Failed to get verified user ID:", error);
        }

        // Fetch user's videos from Supabase using the verified DID
        const supabaseVideos = await getVideosByCreator(verifiedUserId);
        console.log(`📹 Loaded ${supabaseVideos.length} videos from Supabase for profile`);

        // Transform Supabase videos to Video type
        // Use the actual creator data from the join, not the current user's profile
        const transformedVideos: Video[] = supabaseVideos.map((sv) => {
          // Get creator data from the joined result
          const videoCreator = sv.creator;

          // Fallback avatar if needed
          const avatarFallback = "/defaultpfp.png";

          return {
            id: sv.id,
            title: sv.title,
            description: sv.description || "",
            thumbnail: sv.thumbnail || "",
            playbackUrl: sv.playback_url || "",
            duration: sv.duration || 0,
            views: sv.views || 0,
            likes: sv.likes || 0,
            comments: 0, // Not in SupabaseVideo type
            shares: 0, // Not in SupabaseVideo type
            createdAt: new Date(sv.created_at),
            creator: {
              did: sv.creator_did,
              displayName: videoCreator?.display_name || "Creator",
              handle: videoCreator?.handle || "creator",
              avatar: videoCreator?.avatar || avatarFallback,
              verified: videoCreator?.verified || false,
              walletAddress: videoCreator?.wallet_address,
              description: "",
              followerCount: 0,
              followingCount: 0,
              createdAt: new Date(sv.created_at),
            },
            contentType: sv.content_type || ((sv.duration || 0) <= 60 ? "short" : "long"),
            livepeerAssetId: sv.livepeer_asset_id || sv.id,
            category: sv.category || "drag",
            tags: sv.tags || [],
          };
        });

        setUserVideos(transformedVideos);

        // Calculate stats from loaded videos
        const totalViews = transformedVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalLikes = transformedVideos.reduce((sum, v) => sum + (v.likes || 0), 0);

        setStats((prev) => ({
          ...prev,
          totalViews,
          totalLikes,
          videoCount: transformedVideos.length,
        }));
      } catch (error) {
        console.error("Failed to load videos from Supabase:", error);
        // Fallback to localStorage
        const localVideos = getLocalVideos();
        setUserVideos(localVideos);

        const totalViews = localVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalLikes = localVideos.reduce((sum, v) => sum + (v.likes || 0), 0);

        setStats(prev => ({
          ...prev,
          totalViews,
          totalLikes,
          videoCount: localVideos.length,
        }));
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated && user?.id) {
      loadVideos();
    }
  }, [isAuthenticated, user?.id, getAccessToken]);

  // Load Bluesky data
  useEffect(() => {
    async function loadAllBlueskyData() {
      try {
        const [sessionResponse, profileResponse, userFeedResponse] = await Promise.all([
          fetch("/api/bluesky/session"),
          fetch("/api/bluesky/profile"),
          fetch("/api/bluesky/user-feed?limit=50") // NEW: User-specific feed
        ]);

        const [sessionData, profileData, userFeedData] = await Promise.all([
          sessionResponse.json(),
          profileResponse.json(),
          userFeedResponse.json()
        ]);

        if (profileData.success && profileData.profile) {
          setBlueskyProfile(profileData.profile);
          // CRITICAL: Only use Bluesky data as fallback if Supabase data doesn't exist
          // This ensures user settings (from Supabase) take priority
          setCreator((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              // Only use Bluesky avatar if no avatar is set in Supabase
              avatar: prev.avatar && prev.avatar !== "/defaultpfp.png" ? prev.avatar : (profileData.profile.avatar || prev.avatar),
              // Only use Bluesky banner if no banner is set in Supabase
              banner: prev.banner || profileData.profile.banner,
              // Only use Bluesky description if no description is set in Supabase
              description: prev.description && prev.description !== "Welcome to my Dragverse profile!" ? prev.description : (profileData.profile.description || prev.description),
              // Store Bluesky follower counts separately for aggregation
              blueskyFollowerCount: profileData.profile.followersCount,
              blueskyFollowingCount: profileData.profile.followsCount,
              blueskyHandle: profileData.profile.handle,
            };
          });
        }

        // NEW: User's own posts from dedicated endpoint
        if (sessionData.connected && userFeedData.success && userFeedData.posts) {
          const userBlueskyPosts = userFeedData.posts;

          // Separate into photos (images without video) and text posts
          const photos = userBlueskyPosts.filter(
            (post: any) => post.thumbnail && !post.playbackUrl?.includes("m3u8")
          );
          const textPosts = userBlueskyPosts.filter(
            (post: any) => !post.thumbnail && !post.playbackUrl
          );

          setUserPhotos(photos);
          setUserPosts(textPosts);
          setStats(prev => ({ ...prev, photoCount: photos.length }));

          console.log(`[Profile] Loaded ${photos.length} photos and ${textPosts.length} text posts from user's Bluesky`);
        }
      } catch (error) {
        console.error("Failed to load Bluesky data:", error);
      }
    }

    if (isAuthenticated) {
      loadAllBlueskyData();
    }
  }, [isAuthenticated]);

  // Fetch aggregated follower stats from all platforms
  useEffect(() => {
    async function loadAggregatedStats() {
      if (!user?.id) return;

      try {
        console.log("[Profile] Fetching aggregated stats...");
        const authToken = await getAccessToken();
        const response = await fetch("/api/stats/aggregate", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.stats) {
            setAggregatedStats(data.stats);
            console.log("[Profile] Aggregated stats loaded:", data.stats);
          }
        }
      } catch (error) {
        console.error("[Profile] Failed to fetch aggregated stats:", error);
      }
    }

    if (isAuthenticated && user?.id) {
      loadAggregatedStats();
    }
  }, [isAuthenticated, user?.id, getAccessToken]);

  if (!isReady || (isAuthenticated && isLoadingProfile)) {
    return (
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <LoadingShimmer className="h-16 w-96 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#EB83EA]/30">
            <FiUser className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Sign in to view your profile</h1>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create an account or sign in to showcase your talent and connect with the drag community.
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

  const videosList = userVideos.filter(v => v.contentType !== 'short' && v.contentType !== 'podcast' && v.contentType !== 'music');
  // Filter bytes to exclude external videos (YouTube/Bluesky) as they can't be played in vertical player
  const bytesList = userVideos.filter(v =>
    v.contentType === 'short' &&
    v.source !== 'youtube' &&
    v.source !== 'bluesky'
  );
  // Filter audio content (podcast and music)
  const audioList = userVideos.filter(v =>
    v.contentType === 'podcast' || v.contentType === 'music'
  );


  return (
    <div className="min-h-screen">
      {/* Livestream Embed - Full width at top (Twitch-style) */}
      <LivestreamEmbed
        creatorDID={creator.did}
        creatorName={creator.displayName}
      />

      {/* Hero Banner - Full width */}
      <div className="relative w-full h-[40vh] md:h-[50vh] bg-gradient-to-br from-[#EB83EA]/20 via-[#7c3aed]/20 to-[#1a0b2e]">
        {creator.banner ? (
          <Image
            src={creator.banner}
            alt="Profile banner"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA] via-[#7c3aed] to-[#1a0b2e]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0f071a]" />

        {/* Profile content overlaying banner */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
              {/* Avatar - Rounded */}
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#0f071a] overflow-hidden bg-[#2f2942] shadow-2xl flex-shrink-0">
                <Image
                  src={creator.avatar}
                  alt={creator.displayName}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              {/* Name, handle, and actions */}
              <div className="flex-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-2">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-2xl">
                      {creator.displayName}
                    </h1>
                    <VerificationBadge
                      badgeType={getUserBadgeType(
                        creator.did,
                        undefined,
                        !!creator.blueskyHandle,
                        !!creator.farcasterHandle
                      )}
                      size={28}
                      className="flex-shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-white/90 text-lg md:text-xl drop-shadow-lg">@{creator.handle}</p>
                  </div>
                  {/* Stats inline */}
                  <div className="flex gap-6 text-sm md:text-base">
                    <div>
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {stats.videoCount}
                      </span>
                      <span className="text-white/80 ml-2">posts</span>
                    </div>
                    <div className="group relative">
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {aggregatedStats ? aggregatedStats.totalFollowers.toLocaleString() : creator.followerCount.toLocaleString()}
                      </span>
                      <span className="text-white/80 ml-2">followers</span>
                      {/* Platform breakdown tooltip */}
                      {aggregatedStats && (aggregatedStats.platforms.bluesky || aggregatedStats.platforms.farcaster || aggregatedStats.platforms.youtube) && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-[#1a0b2e]/95 border border-[#EB83EA]/30 rounded-xl p-3 shadow-xl min-w-[160px] backdrop-blur-sm">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Sources</div>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[#EB83EA]">Dragverse</span>
                                <span className="text-white font-medium">{aggregatedStats.dragverseFollowers.toLocaleString()}</span>
                              </div>
                              {aggregatedStats.platforms.bluesky && aggregatedStats.blueskyFollowers > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-[#0085ff]">Bluesky</span>
                                  <span className="text-white font-medium">{aggregatedStats.blueskyFollowers.toLocaleString()}</span>
                                </div>
                              )}
                              {aggregatedStats.platforms.farcaster && aggregatedStats.farcasterFollowers > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-[#8a63d2]">Farcaster</span>
                                  <span className="text-white font-medium">{aggregatedStats.farcasterFollowers.toLocaleString()}</span>
                                </div>
                              )}
                              {aggregatedStats.platforms.youtube && aggregatedStats.youtubeSubscribers > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-500">YouTube</span>
                                  <span className="text-white font-medium">{aggregatedStats.youtubeSubscribers.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {aggregatedStats ? aggregatedStats.totalFollowing.toLocaleString() : creator.followingCount.toLocaleString()}
                      </span>
                      <span className="text-white/80 ml-2">following</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    onClick={() => router.push("/settings")}
                    className="px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-lg transition-all"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleShareProfile}
                    className="px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-lg transition-all"
                    title="Copy profile link"
                  >
                    {profileLinkCopied ? <FiCheck className="w-5 h-5" /> : <FiShare2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Bio and Social Links */}
        {(creator.description || creator.instagramHandle || creator.tiktokHandle || creator.blueskyHandle || creator.farcasterHandle || creator.website) && (
          <div className="mb-8">
            {creator.description && (
              <p className="text-gray-200 text-base leading-relaxed mb-4 max-w-3xl">
                {creator.description}
              </p>
            )}
            {(creator.instagramHandle || creator.tiktokHandle || creator.website || creator.blueskyHandle || creator.farcasterHandle) && (
              <div className="flex flex-wrap gap-2">
                {creator.instagramHandle && (
                  <a
                    href={`https://instagram.com/${creator.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#E1306C] to-[#C13584] hover:from-[#D12963] hover:to-[#B02575] text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <FaInstagram className="w-3.5 h-3.5" />
                    <span>Instagram</span>
                  </a>
                )}
                {creator.tiktokHandle && (
                  <a
                    href={`https://tiktok.com/@${creator.tiktokHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#000000] to-[#00f2ea] hover:from-[#111111] hover:to-[#00d9d1] text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <FaTiktok className="w-3.5 h-3.5" />
                    <span>TikTok</span>
                  </a>
                )}
                {creator.blueskyHandle && (
                  <a
                    href={`https://bsky.app/profile/${creator.blueskyHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#0085ff] to-[#0066cc] hover:from-[#0077ee] hover:to-[#0055bb] text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <SiBluesky className="w-3.5 h-3.5" />
                    <span>Bluesky</span>
                  </a>
                )}
                {creator.website && (
                  <a
                    href={creator.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2f2942] hover:bg-[#3f3952] text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <FiGlobe className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content Section with Icon Tabs */}
        <div>
          {/* Icon-Based Tabs (Instagram Style) */}
          <div className="flex justify-center gap-12 border-t border-[#2f2942] mb-8">
            <button
              onClick={() => setActiveTab("videos")}
              className={`flex items-center gap-2 py-4 px-2 transition relative ${
                activeTab === "videos"
                  ? "text-[#EB83EA]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FiGrid className="w-6 h-6" />
              <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Videos</span>
              {activeTab === "videos" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
              )}
            </button>

            {bytesList.length > 0 && (
              <button
                onClick={() => setActiveTab("bytes")}
                className={`flex items-center gap-2 py-4 px-2 transition relative ${
                  activeTab === "bytes"
                    ? "text-[#EB83EA]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <FiZap className="w-6 h-6" />
                <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Bytes</span>
                {activeTab === "bytes" && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
                )}
              </button>
            )}

            {audioList.length > 0 && (
              <button
                onClick={() => setActiveTab("audio")}
                className={`flex items-center gap-2 py-4 px-2 transition relative ${
                  activeTab === "audio"
                    ? "text-[#EB83EA]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <FiHeadphones className="w-6 h-6" />
                <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Audio</span>
                {activeTab === "audio" && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-2 py-4 px-2 transition relative ${
                activeTab === "photos"
                  ? "text-[#EB83EA]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FiImage className="w-6 h-6" />
              <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Photos</span>
              {activeTab === "photos" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 py-4 px-2 transition relative ${
                activeTab === "posts"
                  ? "text-[#EB83EA]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FiMessageSquare className="w-6 h-6" />
              <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Posts</span>
              {activeTab === "posts" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-2 py-4 px-2 transition relative ${
                activeTab === "about"
                  ? "text-[#EB83EA]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FiInfo className="w-6 h-6" />
              <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">About</span>
              {activeTab === "about" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
              )}
            </button>
          </div>

          {/* Tab Content - 3 Column Grid */}
          {activeTab === "videos" && (
            <div>
              {videosList.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {videosList.map((video) => (
                    <div
                      key={video.id}
                      className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                      onClick={() => router.push(`/watch/${video.id}`)}
                    >
                      <Image
                        src={video.thumbnail || "/default-thumbnail.jpg"}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex items-center gap-4 text-white">
                          <div className="flex items-center gap-1">
                            <FiEye className="w-5 h-5" />
                            <span className="font-semibold">{video.views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FiHeart className="w-5 h-5" />
                            <span className="font-semibold">{video.likes.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
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
                    className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
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
                <>
                  {/* Grid of Bytes Thumbnails */}
                  <div className="grid grid-cols-3 gap-1">
                    {bytesList.map((byte, index) => (
                      <div
                        key={byte.id}
                        className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                        onClick={() => {
                          setSelectedByteIndex(index);
                          setShowBytePlayer(true);
                        }}
                      >
                        <Image
                          src={byte.thumbnail || "/default-thumbnail.jpg"}
                          alt={byte.title}
                          fill
                          className="object-cover group-hover:opacity-80 transition-opacity"
                        />
                        {/* Hover Overlay with Stats */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-4 text-white">
                            <div className="flex items-center gap-1">
                              <FiEye className="w-5 h-5" />
                              <span className="font-semibold">{byte.views?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FiHeart className="w-5 h-5" />
                              <span className="font-semibold">{byte.likes?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </div>
                        {/* Bytes Badge */}
                        <div className="absolute top-2 right-2 bg-[#EB83EA] p-2 rounded-full">
                          <FiZap className="w-4 h-4 text-white" />
                        </div>
                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
                          {Math.floor(byte.duration / 60)}:{(byte.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* BytesSlider Modal (opens when thumbnail clicked) */}
                  {showBytePlayer && (
                    <BytesSlider
                      bytesList={bytesList}
                      initialIndex={selectedByteIndex}
                      onClose={() => setShowBytePlayer(false)}
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiZap className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Bytes Yet</h3>
                  <p className="text-gray-400 mb-6">Start uploading your short-form content!</p>
                  <button
                    onClick={() => router.push("/upload")}
                    className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                  >
                    Upload Your First Byte
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "audio" && (
            <div>
              {audioList.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {audioList.map((audio) => (
                    <div
                      key={audio.id}
                      className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                      onClick={() => router.push(`/listen/${audio.id}`)}
                    >
                      <Image
                        src={audio.thumbnail || "/default-thumbnail.jpg"}
                        alt={audio.title}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex items-center gap-4 text-white">
                          <div className="flex items-center gap-1">
                            <FiEye className="w-5 h-5" />
                            <span className="font-semibold">{audio.views?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FiHeart className="w-5 h-5" />
                            <span className="font-semibold">{audio.likes?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>
                      {/* Audio Icon Badge */}
                      <div className="absolute top-2 right-2 bg-black/80 p-2 rounded-full">
                        <FiHeadphones className="w-4 h-4 text-[#EB83EA]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiMusic className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Audio Yet</h3>
                  <p className="text-gray-400 mb-6">Start uploading your podcasts and music!</p>
                  <button
                    onClick={() => router.push("/upload")}
                    className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                  >
                    Upload Your First Audio
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "photos" && (
            <div>
              {userPhotos.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-1">
                    {userPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhotoIndex(index)}
                        className="group relative aspect-square bg-black overflow-hidden cursor-pointer"
                      >
                        <Image
                          src={photo.thumbnail}
                          alt={photo.description || "Photo"}
                          fill
                          className="object-cover group-hover:opacity-80 transition-opacity"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Photo Viewer Modal */}
                  {selectedPhotoIndex !== null && (
                    <PhotoViewerModal
                      photos={userPhotos}
                      initialIndex={selectedPhotoIndex}
                      onClose={() => setSelectedPhotoIndex(null)}
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiStar className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {creator.blueskyHandle ? "No Photos Yet" : "Connect Bluesky"}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {creator.blueskyHandle
                      ? "Share your photos with the community"
                      : "Connect your Bluesky account to share photos"}
                  </p>
                  {!creator.blueskyHandle && (
                    <button
                      onClick={() => router.push("/settings")}
                      className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                    >
                      Connect Bluesky
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "posts" && (
            <div>
              {userPosts.length > 0 ? (
                <div className="max-w-3xl mx-auto space-y-4">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/20 transition-all"
                    >
                      <p className="text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed">
                        {post.description}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span className="flex items-center gap-2">
                          <FiCalendar className="w-4 h-4" />
                          {new Date(post.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {post.externalUrl && (
                          <a
                            href={post.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#EB83EA] hover:text-[#E748E6] transition font-semibold"
                          >
                            View on Bluesky →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiUser className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {creator.blueskyHandle ? "No Posts Yet" : "Connect Bluesky"}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {creator.blueskyHandle
                      ? "Share your thoughts with the community"
                      : "Connect your Bluesky account to share updates"}
                  </p>
                  {!creator.blueskyHandle && (
                    <button
                      onClick={() => router.push("/settings")}
                      className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                    >
                      Connect Bluesky
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-6">
                {/* Profile Link Section */}
                <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                  <h3 className="text-lg font-bold text-[#EB83EA] mb-3 uppercase tracking-wide">Profile Link</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#0f071a] rounded-xl px-4 py-3 border border-[#EB83EA]/20">
                      <p className="text-gray-300 font-mono text-sm break-all">
                        {typeof window !== 'undefined' ? `${window.location.origin}/u/${creator.handle}` : `/u/${creator.handle}`}
                      </p>
                    </div>
                    <button
                      onClick={handleShareProfile}
                      className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      {profileLinkCopied ? (
                        <>
                          <FiCheck className="w-5 h-5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <FiShare2 className="w-5 h-5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bio Section */}
                <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                  <h3 className="text-lg font-bold text-[#EB83EA] mb-3 uppercase tracking-wide">About</h3>
                  <p className="text-gray-200 leading-relaxed">
                    {creator.description || "No bio added yet"}
                  </p>
                </div>

                {/* Social Links */}
                {(creator.instagramHandle || creator.tiktokHandle || creator.website || creator.blueskyHandle) && (
                  <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                    <h3 className="text-lg font-bold text-[#EB83EA] mb-4 uppercase tracking-wide">Social Links</h3>
                    <div className="space-y-3">
                      {creator.instagramHandle && (
                        <a
                          href={`https://instagram.com/${creator.instagramHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Instagram:</span>
                          <span>@{creator.instagramHandle}</span>
                        </a>
                      )}
                      {creator.tiktokHandle && (
                        <a
                          href={`https://tiktok.com/@${creator.tiktokHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">TikTok:</span>
                          <span>@{creator.tiktokHandle}</span>
                        </a>
                      )}
                      {creator.blueskyHandle && (
                        <a
                          href={`https://bsky.app/profile/${creator.blueskyHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Bluesky:</span>
                          <span>@{creator.blueskyHandle}</span>
                        </a>
                      )}
                      {creator.website && (
                        <a
                          href={creator.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Website:</span>
                          <span>{creator.website}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Join Date */}
                <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                  <h3 className="text-lg font-bold text-[#EB83EA] mb-3 uppercase tracking-wide">Member Since</h3>
                  <p className="text-gray-200 flex items-center gap-2">
                    <FiCalendar className="w-5 h-5" />
                    {creator.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
