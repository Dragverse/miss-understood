"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FiArrowLeft, FiHeart, FiEye, FiVideo, FiFilm, FiHeadphones, FiMessageSquare, FiMusic, FiGrid, FiShare2, FiPlay, FiClock } from "react-icons/fi";
import { FaYoutube } from "react-icons/fa";
import { usePrivy } from "@privy-io/react-auth";
import { BlueskyBadge } from "@/components/profile/bluesky-badge";
import { FarcasterBadge } from "@/components/profile/farcaster-badge";
import { YouTubeBadge } from "@/components/profile/youtube-badge";
import { InstagramBadge } from "@/components/profile/instagram-badge";
import { TikTokBadge } from "@/components/profile/tiktok-badge";
import { WebsiteBadge } from "@/components/profile/website-badge";
import { ProfileActionButtons } from "@/components/profile/profile-action-buttons";
import { VerificationBadge } from "@/components/profile/verification-badge";
import Link from "next/link";
import { LivestreamEmbed } from "@/components/profile/livestream-embed";
import { getCreatorByHandleOrDID } from "@/lib/supabase/creators";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { getVideosByCreator } from "@/lib/supabase/videos";
import { useBlueskyProfileByHandle } from "@/lib/bluesky/hooks";
import { Creator, Video } from "@/types";
import { getUserBadgeType } from "@/lib/verification";
import { PostCard as FeedPostCard } from "@/components/feed/post-card";
import { ProfileShareModal } from "@/components/profile/profile-share-modal";
import { useLiveCreatorsStore } from "@/lib/store/live-creators";

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
  const [activeTab, setActiveTab] = useState<"videos" | "snapshots" | "audio" | "posts">("videos");
  const currentUserDID = user?.id;

  // Content states
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const isCreatorLive = useLiveCreatorsStore((s) => s.isLive(creator?.did));

  // Only show the livestream section for creators who are approved streamers (pink/golden badge)
  // or are currently live. Regular profiles shouldn't show the offline embed or chat.
  const creatorBadgeType = creator ? getUserBadgeType(
    creator.did,
    undefined,
    !!creator.blueskyHandle,
    !!creator.farcasterHandle
  ) : null;
  const creatorCanLivestream = creatorBadgeType === 'golden' || creatorBadgeType === 'pink';
  const showLivestreamSection = isCreatorLive || creatorCanLivestream;
  const [connectedBlueskyStats, setConnectedBlueskyStats] = useState<{ followersCount: number; followsCount: number } | null>(null);
  const profileLoadedRef = useRef<string | null>(null);

  // Reset when handle changes
  useEffect(() => {
    profileLoadedRef.current = null;
    setProfileType("loading");
    setCreator(null);
    setUserVideos([]);
    setUserPosts([]);
    setConnectedBlueskyStats(null);
  }, [handle]);

  // Try to fetch Bluesky profile if it looks like a Bluesky handle
  const isBlueskyHandle = handle.includes(".bsky.social") || handle.includes(".");
  const { profile: blueskyProfile, isLoading: blueskyLoading, error: blueskyError } = useBlueskyProfileByHandle(
    isBlueskyHandle ? handle : null
  );

  const handleShareProfile = () => {
    setShowShareModal(true);
  };

  // Determine profile type and load data
  useEffect(() => {
    async function loadProfile() {
      // Skip if we already loaded this handle successfully
      if (profileLoadedRef.current === handle) return;

      // First, try to find in Supabase (Dragverse user)
      try {
        const ceramicProfile = await getCreatorByHandleOrDID(handle);
        if (ceramicProfile) {
          profileLoadedRef.current = handle;
          setCreator(transformSupabaseCreator(ceramicProfile));
          setProfileType("dragverse");

          // Load content for Dragverse user
          const isOwner = currentUserDID === ceramicProfile.did;
          loadUserContent(ceramicProfile.did, isOwner);

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
            profileLoadedRef.current = handle;
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
  async function loadUserContent(creatorDID: string, isOwner = false) {
    setIsLoadingContent(true);
    try {
      // Fetch Dragverse videos and posts in parallel
      // Owner sees scheduled content too
      const [videos, postsResponse] = await Promise.all([
        getVideosByCreator(creatorDID, 50, isOwner).catch(err => {
          console.error("Failed to fetch videos:", err);
          return [] as any[];
        }),
        fetch(`/api/posts/feed?creatorDid=${encodeURIComponent(creatorDID)}&limit=50`)
          .catch(err => {
            console.error("Failed to fetch posts:", err);
            return new Response(JSON.stringify({ success: false, posts: [] }), { status: 500 });
          }),
      ]);

      const transformedVideos: Video[] = videos.map((sv) => ({
        id: sv.id,
        title: sv.title,
        description: sv.description || "",
        thumbnail: sv.thumbnail || "",
        playbackUrl: sv.playback_url || "",
        duration: sv.duration || 0,
        views: sv.views || 0,
        likes: sv.likes || 0,
        createdAt: new Date(sv.created_at),
        creator: creator!,
        contentType: sv.content_type || ((sv.duration || 0) <= 60 ? "short" : "long"),
        livepeerAssetId: sv.livepeer_asset_id || sv.id,
        category: sv.category || "drag",
        tags: sv.tags || [],
        source: (sv as any).source,
        publishedAt: sv.published_at ? new Date(sv.published_at) : null,
        premiereMode: sv.premiere_mode || null,
      }));

      setUserVideos(transformedVideos);

      // Parse posts data
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        if (postsData.success && postsData.posts) {
          setUserPosts(postsData.posts);
        }
      }
    } catch (error) {
      console.error("Failed to load content:", error);
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

  // Fetch Bluesky posts for external profiles
  async function fetchBlueskyContent(blueskyHandle: string) {
    try {
      const response = await fetch(`/api/bluesky/feed?limit=50`);
      const data = await response.json();

      if (data.success && data.posts) {
        const userBlueskyPosts = data.posts.filter((post: any) =>
          post.creator?.handle === blueskyHandle || post.author?.handle === blueskyHandle
        );
        setUserPosts(userBlueskyPosts);
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
  const videosList = userVideos.filter(v => v.contentType !== 'short' && v.contentType !== 'podcast' && v.contentType !== 'music' && v.source !== 'youtube');
  const snapshotsList = userVideos.filter(v => v.contentType === 'short' && v.source !== 'youtube' && v.source !== 'bluesky');
  const audioList = userVideos.filter(v => v.contentType === 'podcast' || v.contentType === 'music');

  // Stats - total content count across all types
  const stats = {
    contentCount: userVideos.length + userPosts.length,
    totalViews: userVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    totalLikes: userVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
  };

  // Render profile
  return (
    <div className="min-h-screen pb-28 md:pb-6">
      {/* ── Unified profile card ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-8 pt-4 md:pt-6" id="livestream">
        <div className="relative rounded-[32px] overflow-hidden bg-[#1a0b2e] shadow-2xl">

          {/* Card background: creator's banner */}
          <div className="absolute inset-0">
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
            {/* Gradient: strong at bottom for readability, light at top */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/90" />
          </div>

          {/* Livestream player — only for approved streamers or when live */}
          {showLivestreamSection && (
            <div className="relative z-10 p-3 sm:p-4 pb-0">
              <div className="rounded-[20px] overflow-hidden shadow-xl">
                <LivestreamEmbed
                  creatorDID={creator.did}
                  creatorName={creator.displayName}
                  creatorHandle={creator.handle}
                />
              </div>
            </div>
          )}

          {/* Creator info */}
          <div className="relative z-10 px-4 sm:px-6 md:px-8 pt-4 pb-5 md:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {isCreatorLive && (
                  <>
                    {/* Soft outer glow */}
                    <span className="absolute -inset-3 rounded-full bg-gradient-to-br from-[#EB83EA] via-fuchsia-400 to-red-400 opacity-50 blur-lg animate-pulse" />
                    {/* Crisp gradient ring */}
                    <span className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[#EB83EA] via-fuchsia-400 to-red-400" />
                  </>
                )}
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-[3px] border-[#1a0b2e] overflow-hidden bg-[#2f2942] shadow-2xl">
                  <Image
                    src={creator.avatar}
                    alt={creator.displayName}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {isCreatorLive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-full shadow-lg shadow-red-500/40 z-10 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-[10px] font-bold uppercase tracking-wide">Live</span>
                  </div>
                )}
              </div>

              {/* Name, handle, stats, actions */}
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  {/* Name + live link + badge */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-2xl leading-tight">
                      {creator.displayName}
                    </h1>
                    <VerificationBadge
                      badgeType={getUserBadgeType(
                        creator.did,
                        undefined,
                        !!creator.blueskyHandle,
                        !!creator.farcasterHandle
                      )}
                      size={24}
                      className="flex-shrink-0"
                    />
                  </div>

                  {/* Handle + social badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-white/80 text-sm md:text-base">@{creator.handle}</p>
                    {creator.blueskyHandle && <BlueskyBadge handle={creator.blueskyHandle} />}
                    {creator.farcasterHandle && <FarcasterBadge username={creator.farcasterHandle} />}
                    {creator.youtubeChannelId && <YouTubeBadge channelId={creator.youtubeChannelId} channelName={creator.youtubeChannelName} />}
                    {creator.instagramHandle && <InstagramBadge handle={creator.instagramHandle} />}
                    {creator.tiktokHandle && <TikTokBadge handle={creator.tiktokHandle} />}
                    {creator.website && <WebsiteBadge url={creator.website} />}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 text-sm flex-wrap">
                    <div>
                      <span className="font-bold text-lg text-white drop-shadow-lg">
                        {isLoadingContent ? "—" : stats.contentCount}
                      </span>
                      <span className="text-white/70 ml-1.5">content</span>
                    </div>
                    <div className="group relative">
                      <span className="font-bold text-lg text-white drop-shadow-lg">
                        {(creator.followerCount || 0).toLocaleString()}
                      </span>
                      <span className="text-white/70 ml-1.5">followers</span>
                      {((connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0) > 0 || (creator.youtubeSubscriberCount || 0) > 0) && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-[#1a0b2e]/95 border border-[#EB83EA]/30 rounded-xl p-3 shadow-xl min-w-[160px] backdrop-blur-sm">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Also on</div>
                            <div className="space-y-1.5 text-sm">
                              {(connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0) > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-[#0085ff]">Bluesky</span>
                                  <span className="text-white font-medium">{(connectedBlueskyStats?.followersCount || blueskyProfile?.followersCount || 0).toLocaleString()}</span>
                                </div>
                              )}
                              {(creator.youtubeSubscriberCount || 0) > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-500">YouTube</span>
                                  <span className="text-white font-medium">{(creator.youtubeSubscriberCount || 0).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-lg text-white drop-shadow-lg">
                        {(creator.followingCount || 0).toLocaleString()}
                      </span>
                      <span className="text-white/70 ml-1.5">following</span>
                    </div>
                    {(creator.tipCount || 0) > 0 && (
                      <div>
                        <span className="font-bold text-lg text-white drop-shadow-lg">
                          {(creator.tipCount || 0).toLocaleString()}
                        </span>
                        <span className="text-white/70 ml-1.5">tips</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <ProfileActionButtons
                    creator={creator}
                    isOwnProfile={currentUserDID === creator.did}
                    isDragverseUser={profileType === "dragverse"}
                    currentUserDID={currentUserDID}
                  />
                  <button
                    onClick={handleShareProfile}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all"
                    title="Copy profile link"
                  >
                    <FiShare2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bio — full width below avatar+name row */}
            {creator.description && (
              <div className="mt-3 sm:pl-[calc(5rem+1rem)] md:pl-[calc(6rem+1rem)]">
                <p className={`text-white/80 text-sm leading-relaxed drop-shadow-lg ${!bioExpanded ? "line-clamp-2" : ""}`}>
                  {creator.description}
                </p>
                {!bioExpanded && creator.description.length > 120 && (
                  <button onClick={() => setBioExpanded(true)} className="text-white/50 hover:text-white/80 text-xs font-medium mt-0.5 transition">
                    more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
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
              aria-label="View videos content"
              aria-current={activeTab === "videos" ? "page" : undefined}
            >
              <FiGrid className="w-6 h-6" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Videos</span>
              {activeTab === "videos" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
              )}
            </button>

            {snapshotsList.length > 0 && (
              <button
                onClick={() => setActiveTab("snapshots")}
                className={`flex items-center gap-2 py-4 px-2 transition relative ${
                  activeTab === "snapshots"
                    ? "text-[#EB83EA]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                aria-label="View snapshots content"
                aria-current={activeTab === "snapshots" ? "page" : undefined}
              >
                <FiFilm className="w-6 h-6" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Snapshots</span>
                {activeTab === "snapshots" && (
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
                aria-label="View audio content"
                aria-current={activeTab === "audio" ? "page" : undefined}
              >
                <FiHeadphones className="w-6 h-6" />
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Audio</span>
                {activeTab === "audio" && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#EB83EA]"></div>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 py-4 px-2 transition relative ${
                activeTab === "posts"
                  ? "text-[#EB83EA]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              aria-label="View posts and photos"
              aria-current={activeTab === "posts" ? "page" : undefined}
            >
              <FiMessageSquare className="w-6 h-6" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Posts</span>
              {activeTab === "posts" && (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-1">
                  {videosList.map((video) => (
                    <div
                      key={video.id}
                      className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                      onClick={() => {
                        const upcoming = video.premiereMode === 'countdown' && video.publishedAt && new Date(video.publishedAt) > new Date();
                        router.push(upcoming ? `/premiere/${video.id}` : `/watch/${video.id}`);
                      }}
                    >
                      <Image
                        src={getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', (video as any).playbackId)}
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
                      {/* YouTube Badge */}
                      {video.source === "youtube" && (
                        <div className="absolute top-2 left-2 bg-red-600 p-1.5 rounded-md flex items-center gap-1">
                          <FaYoutube className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      {/* Premiere / Scheduled badge — visible to all for countdown, owner-only for silent */}
                      {video.publishedAt && new Date(video.publishedAt) > new Date() && (
                        video.premiereMode === "countdown" || user?.id === creator?.did
                      ) && (
                        <div className="absolute top-2 left-2 bg-[#EB83EA] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
                          <FiClock className="w-3.5 h-3.5 text-white" />
                          <span className="text-white text-xs font-bold">
                            {video.premiereMode === "countdown" ? "Premiere" : "Scheduled"}
                          </span>
                        </div>
                      )}
                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
                        {video.source === "youtube" ? (
                          <FiPlay className="w-3 h-3 inline" />
                        ) : (
                          `${Math.floor((video.duration || 0) / 60)}:${((video.duration || 0) % 60).toString().padStart(2, '0')}`
                        )}
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

          {activeTab === "snapshots" && (
            <div>
              {snapshotsList.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-1">
                    {snapshotsList.map((snapshot) => (
                      <Link
                        key={snapshot.id}
                        href={
                          snapshot.premiereMode === 'countdown' && snapshot.publishedAt && new Date(snapshot.publishedAt) > new Date()
                            ? `/premiere/${snapshot.id}`
                            : `/snapshots?v=${snapshot.id}`
                        }
                        className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                      >
                        <Image
                          src={getSafeThumbnail(snapshot.thumbnail, '/default-thumbnail.jpg', (snapshot as any).playbackId)}
                          alt={snapshot.title}
                          fill
                          className="object-cover group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-4 text-white">
                            <div className="flex items-center gap-1">
                              <FiEye className="w-5 h-5" />
                              <span className="font-semibold">{snapshot.views?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FiHeart className="w-5 h-5" />
                              <span className="font-semibold">{snapshot.likes?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 bg-[#EB83EA] p-2 rounded-full">
                          <FiFilm className="w-4 h-4 text-white" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiFilm className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Snapshots Yet</h3>
                  <p className="text-gray-400">Short-form content will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "audio" && (
            <div>
              {audioList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-1">
                  {audioList.map((audio) => (
                    <div
                      key={audio.id}
                      className="relative aspect-square group bg-black overflow-hidden cursor-pointer"
                      onClick={() => {
                        const upcoming = audio.premiereMode === 'countdown' && audio.publishedAt && new Date(audio.publishedAt) > new Date();
                        router.push(upcoming ? `/premiere/${audio.id}` : `/listen/${audio.id}`);
                      }}
                    >
                      <Image
                        src={getSafeThumbnail(audio.thumbnail, '/default-thumbnail.jpg', (audio as any).playbackId)}
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

          {activeTab === "posts" && (
            <div>
              {userPosts.length > 0 ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  {userPosts.filter(post => post && typeof post === 'object').map((post) => (
                    <FeedPostCard
                      key={post.id}
                      post={{
                        ...post,
                        description: post.text_content || post.description || "",
                        createdAt: post.created_at || post.createdAt,
                        thumbnail: post.media_urls?.[0] || post.thumbnail,
                        creator: post.creator ? {
                          displayName: post.creator.display_name || post.creator.displayName,
                          handle: post.creator.handle,
                          avatar: post.creator.avatar,
                          did: post.creator.did,
                          blueskyHandle: post.creator.blueskyHandle,
                        } : {
                          displayName: creator!.displayName,
                          handle: creator!.handle,
                          avatar: creator!.avatar,
                          did: creator!.did,
                          blueskyHandle: creator!.blueskyHandle,
                        },
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiMessageSquare className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Posts Yet</h3>
                  <p className="text-gray-400">When {creator?.displayName} shares stories, they&apos;ll appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share Profile Modal */}
      <ProfileShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        profileUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${creator.handle}`}
        displayName={creator.displayName}
        handle={creator.handle}
      />
    </div>
  );
}
