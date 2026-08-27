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
import { CreatorBoard } from "@/components/profile/creator-board";
import { useBoard } from "@/lib/hooks/use-board";
import { VERTICAL_VIDEO_ENABLED } from "@/config/features";
import { ProfileTabs, isProfileTab, type ProfileTab } from "@/components/profile/profile-tabs";
import { EventRow } from "@/components/blocks/upcoming-block";
import { NoteCard } from "@/components/notes/note-card";
import type { DragEvent } from "@/lib/events/types";

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
  // The board is the landing view; ?tab= deep-links the rest.
  const [activeTab, setActiveTab] = useState<ProfileTab>("user");
  const currentUserDID = user?.id;

  // Content states
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const isCreatorLive = useLiveCreatorsStore((s) => s.isLive(creator?.did));

  // The creator's arranged board. Only Dragverse profiles have one — external
  // Bluesky profiles fall back to the tab layout further down.
  const { board, mutations: boardMutations } = useBoard(
    profileType === "dragverse" ? handle : null
  );

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
  const [events, setEvents] = useState<DragEvent[]>([]);
  const hasEvents = events.length > 0;
  const [connectedBlueskyStats, setConnectedBlueskyStats] = useState<{ followersCount: number; followsCount: number } | null>(null);
  const profileLoadedRef = useRef<string | null>(null);

  // Reset when handle changes
  // Honour ?tab= on first load. Runs once: after that the tab bar owns the
  // state and writes back to the URL itself.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (isProfileTab(requested)) setActiveTab(requested);
  }, []);

  // Events power both the Events tab and whether that tab is offered.
  useEffect(() => {
    if (profileType !== "dragverse" || !handle) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/events?handle=${encodeURIComponent(handle)}&limit=50`
        );
        const data = await response.json();
        if (!cancelled && response.ok) setEvents(data.events ?? []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, profileType]);

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

  // Only offer a tab when it has something behind it, so a new creator sees
  // just the board rather than four empty sections. Events are fetched by the
  // panel itself, so the tab is always offered on your own profile.
  const availableTabs = new Set<ProfileTab>();
  if (videosList.length > 0 || snapshotsList.length > 0) availableTabs.add("videos");
  if (audioList.length > 0) availableTabs.add("audio");
  if (userPosts.length > 0) availableTabs.add("notes");
  if (hasEvents || currentUserDID === creator.did) availableTabs.add("events");

  // Loaded once here and handed to every block, so a board with a dozen
  // blocks doesn't issue a dozen requests for the same creator's content.
  const blockContent = {
    creator: creator!,
    videos: [...videosList, ...snapshotsList],
    audio: audioList,
    posts: userPosts,
  };

  // Stats - total content count across all types
  const stats = {
    contentCount: userVideos.length + userPosts.length,
    totalViews: userVideos.reduce((sum, v) => sum + (v.views || 0), 0),
    totalLikes: userVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
  };

  // Render profile
  return (
    <div className="min-h-screen pb-28 md:pb-6">
      {/*
        Profile-wide background: the creator's banner sits behind the entire
        page, not just the header card. Fixed rather than absolute so it stays
        put while the board scrolls over it.

        aria-hidden + pointer-events-none because it's pure decoration and must
        never intercept clicks on the content above it.
      */}
      <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
        {creator.banner ? (
          <Image src={creator.banner} alt="" fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA] via-[#7c3aed] to-[#1a0b2e]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          </div>
        )}
        {/*
          Scrim. Light at the top so the banner reads, deepening to near-solid
          further down so board text stays legible over a busy photo.
        */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0f071a]/85 to-[#0f071a]/95" />
      </div>

      {/* ── Unified profile card ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-8 pt-4 md:pt-6" id="livestream">
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl">

          {/* Card scrim only — the banner itself now lives behind the whole page. */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-black/20 to-black/60" />

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
        {/*
          Dragverse creators get the board they arranged. External Bluesky
          profiles have no profile_blocks rows, so they keep the tab layout —
          that path is also the acquisition funnel for unclaimed profiles.
        */}
        <ProfileTabs
          active={activeTab}
          available={availableTabs}
          onChange={(tab) => {
            setActiveTab(tab);
            // Keep the tab in the URL so sections are linkable and survive a
            // refresh. replaceState avoids stacking history on every click.
            const url = new URL(window.location.href);
            if (tab === "user") url.searchParams.delete("tab");
            else url.searchParams.set("tab", tab);
            window.history.replaceState(null, "", url);
          }}
        />

        {activeTab === "user" && board && (
          <CreatorBoard
            board={board}
            content={blockContent}
            onMutate={board.isOwner ? boardMutations : undefined}
          />
        )}

        <div>

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
                        router.push(
                          upcoming
                            ? `/premiere/${video.id}`
                            : video.contentType === 'short'
                            ? `/snapshots?v=${video.id}`
                            : `/watch/${video.id}`
                        );
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

          {activeTab === "events" && (
            <div className="max-w-3xl mx-auto">
              {events.length > 0 ? (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id}>
                      <EventRow event={event} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-16">
                  <h3 className="text-xl font-bold mb-2">No Dates Yet</h3>
                  <p className="text-gray-400">
                    {currentUserDID === creator.did
                      ? "Add gigs and shows from your dashboard."
                      : `When ${creator.displayName} announces dates, they'll appear here`}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              {userPosts.length > 0 ? (
                <div className="columns-1 sm:columns-2 gap-4 [column-fill:_balance] max-w-4xl mx-auto">
                  {userPosts
                    .filter((post) => post && typeof post === "object")
                    .map((post) => (
                      <div key={post.id} className="mb-4 break-inside-avoid">
                        <NoteCard note={post} />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiMessageSquare className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Notes Yet</h3>
                  <p className="text-gray-400">When {creator?.displayName} writes something, it&apos;ll appear here</p>
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
