"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FiArrowLeft, FiHeart, FiEye, FiVideo, FiZap, FiHeadphones, FiImage, FiMessageSquare, FiInfo, FiMusic, FiGrid, FiCalendar, FiGlobe, FiShare2, FiCheck, FiStar, FiUser } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { BlueskyBadge } from "@/components/profile/bluesky-badge";
import { FarcasterBadge } from "@/components/profile/farcaster-badge";
import { ProfileActionButtons } from "@/components/profile/profile-action-buttons";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { PhotoViewerModal } from "@/components/modals/photo-viewer-modal";
import { BytesSlider } from "@/components/profile/bytes-slider";
import { getCreatorByHandleOrDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { getVideosByCreator } from "@/lib/supabase/videos";
import { useBlueskyProfileByHandle } from "@/lib/bluesky/hooks";
import { Creator, Video } from "@/types";
import { getUserBadgeType } from "@/lib/verification";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

/**
 * Dynamic Profile Page - Instagram Style
 * Handles both Dragverse users and external Bluesky accounts
 * Route: /u/[handle]
 */
export default function DynamicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const { user } = usePrivy();

  const [profileType, setProfileType] = useState<"loading" | "dragverse" | "bluesky" | "not-found">("loading");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [activeTab, setActiveTab] = useState<"videos" | "bytes" | "audio" | "photos" | "posts" | "about">("videos");
  const currentUserDID = user?.id;

  // Content states
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [showBytePlayer, setShowBytePlayer] = useState(false);
  const [selectedByteIndex, setSelectedByteIndex] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [connectedBlueskyStats, setConnectedBlueskyStats] = useState<{ followersCount: number; followsCount: number } | null>(null);

  // Try to fetch Bluesky profile if it looks like a Bluesky handle
  const isBlueskyHandle = handle.includes(".bsky.social") || handle.includes(".");
  const { profile: blueskyProfile, isLoading: blueskyLoading, error: blueskyError } = useBlueskyProfileByHandle(
    isBlueskyHandle ? handle : null
  );

  // Copy profile link to clipboard
  const handleShareProfile = async () => {
    if (!creator) return;
    const profileUrl = `${window.location.origin}/u/${creator.handle}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setProfileLinkCopied(true);
      setTimeout(() => setProfileLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy profile link:", error);
    }
  };

  // Determine profile type and load data
  useEffect(() => {
    async function loadProfile() {
      // First, try to find in Supabase (Dragverse user)
      try {
        const ceramicProfile = await getCreatorByHandleOrDID(handle);
        if (ceramicProfile) {
          setCreator(transformSupabaseCreator(ceramicProfile));
          setProfileType("dragverse");

          // Load content for Dragverse user (Dragverse data only for performance)
          loadUserContent(ceramicProfile.did);

          // Fetch Bluesky stats if user has connected Bluesky
          if (ceramicProfile.bluesky_handle) {
            fetchBlueskyStats(ceramicProfile.bluesky_handle);
          }

          // Note: We don't fetch external Bluesky content for Dragverse profiles
          // to keep page load fast. Profile only shows Dragverse-native content.
          // Bluesky badge will still appear if connected.
          return;
        }
      } catch (error) {
        console.log("Not found in Supabase, checking Bluesky");
      }

      // If not in Supabase and looks like Bluesky handle, wait for Bluesky fetch
      if (isBlueskyHandle) {
        if (!blueskyLoading) {
          if (blueskyProfile) {
            // Convert Bluesky profile to Creator format
            setCreator({
              did: blueskyProfile.did,
              handle: blueskyProfile.handle,
              displayName: blueskyProfile.displayName,
              avatar: blueskyProfile.avatar || "/defaultpfp.png",
              banner: blueskyProfile.banner || undefined,
              description: blueskyProfile.description || "",
              followerCount: blueskyProfile.followersCount,
              followingCount: blueskyProfile.followsCount,
              blueskyFollowerCount: blueskyProfile.followersCount,
              blueskyHandle: blueskyProfile.handle,
              blueskyDID: blueskyProfile.did,
              createdAt: new Date(),
              verified: false,
            });
            setProfileType("bluesky");

            // Fetch Bluesky posts
            fetchBlueskyContent(blueskyProfile.handle);
          } else if (blueskyError) {
            setProfileType("not-found");
          }
        }
      } else {
        // Not a Bluesky handle and not in Supabase
        setProfileType("not-found");
      }
    }

    loadProfile();
  }, [handle, blueskyProfile, blueskyLoading, blueskyError, isBlueskyHandle]);

  // Load videos and other content from database
  async function loadUserContent(creatorDID: string) {
    setIsLoadingContent(true);
    try {
      const videos = await getVideosByCreator(creatorDID);

      const transformedVideos: Video[] = videos.map((sv) => ({
        id: sv.id,
        title: sv.title,
        description: sv.description || "",
        thumbnail: sv.thumbnail || "",
        playbackUrl: sv.playback_url || "",
        duration: sv.duration || 0,
        views: sv.views || 0,
        likes: sv.likes || 0,
        comments: 0,
        shares: 0,
        createdAt: new Date(sv.created_at),
        creator: creator!,
        contentType: sv.content_type || ((sv.duration || 0) <= 60 ? "short" : "long"),
        livepeerAssetId: sv.livepeer_asset_id || sv.id,
        category: sv.category || "drag",
        tags: sv.tags || [],
        source: (sv as any).source,
      }));

      setUserVideos(transformedVideos);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setIsLoadingContent(false);
    }
  }

  // Fetch Bluesky stats for connected users
  async function fetchBlueskyStats(blueskyHandle: string) {
    try {
      const response = await fetch(`/api/bluesky/profile?handle=${encodeURIComponent(blueskyHandle)}`);
      const data = await response.json();

      if (data.success && data.profile) {
        setConnectedBlueskyStats({
          followersCount: data.profile.followersCount || 0,
          followsCount: data.profile.followsCount || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch Bluesky stats:", error);
    }
  }

  // Fetch Bluesky posts and photos
  async function fetchBlueskyContent(blueskyHandle: string) {
    try {
      const response = await fetch(`/api/bluesky/feed?limit=50`);
      const data = await response.json();

      if (data.success && data.posts) {
        // Filter posts for this specific user
        const userBlueskyPosts = data.posts.filter((post: any) =>
          post.creator?.handle === blueskyHandle || post.author?.handle === blueskyHandle
        );

        // Separate into photos (images without video) and text posts
        const photos = userBlueskyPosts.filter(
          (post: any) => post.thumbnail && !post.playbackUrl?.includes("m3u8")
        );
        const textPosts = userBlueskyPosts.filter(
          (post: any) => !post.thumbnail && !post.playbackUrl
        );

        setUserPhotos(photos);
        setUserPosts(textPosts);
      }
    } catch (error) {
      console.error("Failed to fetch Bluesky content:", error);
    }
  }

  // Loading state
  if (profileType === "loading" || (isBlueskyHandle && blueskyLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  // Not found state
  if (profileType === "not-found" || !creator) {
    return (
      <div className="container mx-auto max-w-screen-xl px-4 py-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-[#FCF1FC] mb-4">Profile Not Found</h1>
          <p className="text-gray-400 mb-6">
            The profile @{handle} doesn&apos;t exist or is private.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Filter content by type
  const videosList = userVideos.filter(v => v.contentType !== 'short' && v.contentType !== 'podcast' && v.contentType !== 'music');
  const bytesList = userVideos.filter(v => v.contentType === 'short' && v.source !== 'youtube' && v.source !== 'bluesky');
  const audioList = userVideos.filter(v => v.contentType === 'podcast' || v.contentType === 'music');

  // Stats
  const stats = {
    videoCount: userVideos.length,
    totalViews: userVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    totalLikes: userVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
    photoCount: userPhotos.length,
  };

  // Render profile - Hybrid Style (Banner + Instagram tabs)
  return (
    <div className="min-h-screen">
      {/* Back Button - Fixed top left */}
      <button
        onClick={() => router.back()}
        className="fixed top-20 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full transition shadow-lg"
      >
        <FiArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back</span>
      </button>

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
                    {creator.blueskyHandle && (
                      <BlueskyBadge handle={creator.blueskyHandle} />
                    )}
                    {creator.farcasterHandle && (
                      <FarcasterBadge username={creator.farcasterHandle} />
                    )}
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
                        {/* Show aggregated count if Bluesky is connected (either from hook or connected stats) */}
                        {(connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount)
                          ? ((creator.followerCount || 0) + (connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0)).toLocaleString()
                          : (creator.followerCount?.toLocaleString() || 0)
                        }
                      </span>
                      <span className="text-white/80 ml-2">followers</span>
                      {/* Platform breakdown tooltip */}
                      {(connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount) && (connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0) > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-[#1a0b2e]/95 border border-[#EB83EA]/30 rounded-xl p-3 shadow-xl min-w-[160px] backdrop-blur-sm">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Sources</div>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[#EB83EA]">Dragverse</span>
                                <span className="text-white font-medium">{(creator.followerCount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[#0085ff]">Bluesky</span>
                                <span className="text-white font-medium">{(connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {(connectedBlueskyStats?.followsCount || blueskyProfile?.followsCount)
                          ? ((creator.followingCount || 0) + (connectedBlueskyStats?.followsCount || blueskyProfile?.followsCount || 0)).toLocaleString()
                          : (creator.followingCount?.toLocaleString() || 0)
                        }
                      </span>
                      <span className="text-white/80 ml-2">following</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex-shrink-0 flex gap-2">
                  <ProfileActionButtons
                    creator={creator}
                    isOwnProfile={currentUserDID === creator.did}
                    isDragverseUser={profileType === "dragverse"}
                    currentUserDID={currentUserDID}
                  />
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
                {creator.farcasterHandle && (
                  <a
                    href={`https://warpcast.com/${creator.farcasterHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#8a63d2] to-[#6633cc] hover:from-[#7b54c3] hover:to-[#5522bb] text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 1000 1000" fill="currentColor">
                      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
                      <path d="M128.889 253.333L156.111 155.556H193.333V253.333H128.889Z" />
                      <path d="M806.667 253.333L833.889 155.556H871.111V253.333H806.667Z" />
                    </svg>
                    <span>Farcaster</span>
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
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
                </div>
              ) : videosList.length > 0 ? (
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
                            <span className="font-semibold">{video.views?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FiHeart className="w-5 h-5" />
                            <span className="font-semibold">{video.likes?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>
                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
                        {Math.floor((video.duration || 0) / 60)}:{((video.duration || 0) % 60).toString().padStart(2, '0')}
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
                  <p className="text-gray-400">When {creator.displayName} uploads videos, they&apos;ll appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "bytes" && (
            <div>
              {bytesList.length > 0 ? (
                <>
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
                        <div className="absolute top-2 right-2 bg-[#EB83EA] p-2 rounded-full">
                          <FiZap className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>

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
                  <p className="text-gray-400">Short-form content will appear here</p>
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
                  <p className="text-gray-400">Podcasts and music will appear here</p>
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
                    <FiImage className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Photos Yet</h3>
                  <p className="text-gray-400">Photos will appear here</p>
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
                    <FiMessageSquare className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Posts Yet</h3>
                  <p className="text-gray-400">Text posts will appear here</p>
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
                {(creator.instagramHandle || creator.tiktokHandle || creator.website || creator.blueskyHandle || creator.farcasterHandle) && (
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
                {creator.createdAt && (
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
