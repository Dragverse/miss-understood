"use client";

import React, { useState, useEffect } from "react";
import { mockVideos } from "@/lib/utils/mock-data";
import Image from "next/image";
import Link from "next/link";
import { FiMessageCircle, FiShare2, FiUserPlus, FiLock, FiMaximize2, FiMinimize2 } from "react-icons/fi";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { TipModal } from "@/components/video/tip-modal";
import { ShareModal } from "@/components/video/share-modal";
import { ChocolateBar } from "@/components/ui/chocolate-bar";
import { getVideo, getVideos } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { USE_MOCK_DATA } from "@/lib/config/env";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { usePrivy } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { HeartAnimation, ActionButton, EmptyState, LoadingShimmer, MoodBadge } from "@/components/shared";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("token");
  const { getAccessToken, login } = usePrivy();

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [theaterMode, setTheaterMode] = useState(false);

  // Fetch video with access control
  useEffect(() => {
    async function loadVideo() {
      if (USE_MOCK_DATA) {
        // Use mock data in development (no access control)
        const mockVideo = mockVideos.find((v) => v.id === resolvedParams.id);
        setVideo(mockVideo || null);
        setLikes(mockVideo?.likes || 0);
        setIsLoading(false);
        return;
      }

      try {
        // Check access via API (includes privacy check)
        const authToken = await getAccessToken().catch(() => null);

        const accessUrl = new URL(`/api/video/access/${resolvedParams.id}`, window.location.origin);
        if (shareToken) {
          accessUrl.searchParams.set("token", shareToken);
        }

        const accessResponse = await fetch(accessUrl.toString(), {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });

        if (!accessResponse.ok) {
          const accessData = await accessResponse.json();

          if (accessResponse.status === 403) {
            // Access denied
            setAccessDenied(true);
            setAccessDeniedReason(accessData.reason || "You don't have permission to view this video");
            setIsLoading(false);
            return;
          }

          throw new Error("Failed to check video access");
        }

        const accessData = await accessResponse.json();

        if (!accessData.allowed || !accessData.video) {
          setAccessDenied(true);
          setAccessDeniedReason(accessData.reason || "Video not found");
          setIsLoading(false);
          return;
        }

        // Access granted - format video data
        const ceramicVideo = accessData.video;
        const formattedVideo: Video = {
          id: ceramicVideo.id,
          title: ceramicVideo.title,
          description: ceramicVideo.description || "",
          thumbnail: ceramicVideo.thumbnail || "",
          duration: ceramicVideo.duration || 0,
          views: ceramicVideo.views || 0,
          likes: ceramicVideo.likes || 0,
          createdAt: new Date(ceramicVideo.created_at),
          playbackUrl: ceramicVideo.playback_url || "",
          livepeerAssetId: ceramicVideo.livepeer_asset_id || "",
          contentType: ceramicVideo.content_type || "long" as any,
          visibility: ceramicVideo.visibility as any,
          creator: {
            did: ceramicVideo.creator_did,
            handle: "creator",
            displayName: "Creator",
            avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${ceramicVideo.creator_did}`,
            description: "",
            followerCount: 0,
            followingCount: 0,
            createdAt: new Date(),
            verified: false,
          },
          category: ceramicVideo.category || "Other",
          tags: ceramicVideo.tags || [],
        };

        setVideo(formattedVideo);
        setLikes(formattedVideo.likes);
        setAccessDenied(false);
      } catch (error) {
        console.error("Failed to load video:", error);
        toast.error("Failed to load video");
        setVideo(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadVideo();
  }, [resolvedParams.id, shareToken, getAccessToken]);

  // Load related videos from various sources
  useEffect(() => {
    async function loadRelatedVideos() {
      const allVideos: Video[] = [];

      // Try Supabase first
      try {
        const ceramicResult = await getVideos(20);
        if (ceramicResult && ceramicResult.length > 0) {
          // Transform to Video type
          const transformed = ceramicResult.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description || '',
            thumbnail: v.thumbnail || '',
            duration: v.duration || 0,
            views: v.views,
            likes: v.likes,
            createdAt: new Date(v.created_at),
            playbackUrl: v.playback_url || '',
            livepeerAssetId: v.livepeer_asset_id || '',
            contentType: v.content_type as any || 'long',
            creator: {} as any,
            category: v.category || '',
            tags: v.tags || [],
            source: 'ceramic' as const,
          }));
          allVideos.push(...transformed as Video[]);
        }
      } catch (error) {
        console.warn("Supabase unavailable for related videos");
      }

      // Fetch from Bluesky
      try {
        const blueskyResponse = await fetch("/api/bluesky/feed?limit=10");
        if (blueskyResponse.ok) {
          const blueskyData = await blueskyResponse.json();
          if (blueskyData.posts) {
            allVideos.push(...blueskyData.posts);
          }
        }
      } catch (error) {
        console.warn("Bluesky unavailable for related videos");
      }

      // Add local uploads
      const localVideos = getLocalVideos();
      allVideos.push(...localVideos);

      // Filter out current video and same content type
      const related = allVideos
        .filter((v) => v.id !== resolvedParams.id && v.contentType === video?.contentType)
        .slice(0, 5);

      // If not enough related videos, use any videos
      if (related.length < 5) {
        const additional = allVideos
          .filter((v) => v.id !== resolvedParams.id && !related.includes(v))
          .slice(0, 5 - related.length);
        related.push(...additional);
      }

      setRelatedVideos(related);
    }

    if (video) {
      loadRelatedVideos();
    }
  }, [resolvedParams.id, video]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <LoadingShimmer aspectRatio="video" className="mb-6" />
            <LoadingShimmer lines={3} className="mb-4" />
            <LoadingShimmer className="h-16 mb-4" />
          </div>
          <div className="lg:col-span-1">
            <LoadingShimmer lines={5} />
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
            <FiLock className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">{accessDeniedReason}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => login()}
              className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-lg font-semibold transition"
            >
              Sign In
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-4">Video not found</p>
          <Link href="/" className="text-[#EB83EA] hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  const handleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setIsLiked(!isLiked);
  };

  return (
    <div className={`${theaterMode ? "max-w-full" : "max-w-7xl"} mx-auto px-4 py-8 transition-all duration-300`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Video */}
        <div className={`${theaterMode ? "lg:col-span-3" : "lg:col-span-2"} transition-all duration-300`}>
          {/* Livepeer Player with theater mode */}
          <div className="rounded-3xl overflow-hidden mb-6 border-2 border-[#EB83EA]/10 shadow-xl relative group">
            {/* Theater mode toggle */}
            <button
              onClick={() => setTheaterMode(!theaterMode)}
              className="absolute top-4 right-4 z-10 p-3 bg-black/60 hover:bg-[#EB83EA]/80 rounded-xl transition-all opacity-0 group-hover:opacity-100 border border-[#EB83EA]/20"
              title={theaterMode ? "Exit theater mode" : "Enter theater mode"}
            >
              {theaterMode ? (
                <FiMinimize2 className="w-5 h-5 text-white" />
              ) : (
                <FiMaximize2 className="w-5 h-5 text-white" />
              )}
            </button>

            {video.playbackUrl ? (
              <Player.Root
                src={getSrc(video.playbackUrl)}
                aspectRatio={video.contentType === "short" ? 9 / 16 : 16 / 9}
              >
                <Player.Container>
                  <Player.Video
                    className={video.contentType === "short" ? "max-h-[80vh] mx-auto" : ""}
                    style={{ objectFit: "contain" }}
                  />
                  <Player.Controls autoHide={3000}>
                    <Player.PlayPauseTrigger />
                    <Player.Seek>
                      <Player.Track>
                        <Player.SeekBuffer />
                        <Player.Range />
                      </Player.Track>
                      <Player.Thumb />
                    </Player.Seek>
                    <Player.Time />
                    <Player.MuteTrigger />
                    <Player.Volume>
                      <Player.Track>
                        <Player.Range />
                      </Player.Track>
                      <Player.Thumb />
                    </Player.Volume>
                    <Player.FullscreenTrigger />
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            ) : (
              <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center relative">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover rounded-lg"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <p className="text-gray-400">Video not available</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold mb-3 bg-gradient-to-r from-white to-[#EB83EA] bg-clip-text text-transparent">
                  {video.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <span className="text-[#EB83EA] font-bold">{(video.views / 1000).toFixed(1)}K</span> views
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(video.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {/* Mood badge if available */}
                {video.category && (
                  <MoodBadge mood={video.category} size="md" />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-[#EB83EA]/10">
              <HeartAnimation
                initialLiked={isLiked}
                onToggle={handleLike}
                showCount={true}
                count={likes}
              />
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all text-white hover:text-[#EB83EA]">
                <FiMessageCircle className="w-5 h-5" />
                <span>Comment</span>
              </button>
              <ActionButton
                onClick={() => setShareModalOpen(true)}
                variant="secondary"
                icon={<FiShare2 className="w-5 h-5" />}
                size="md"
              >
                Share
              </ActionButton>
              <ActionButton
                onClick={() => setTipModalOpen(true)}
                variant="primary"
                icon={<ChocolateBar size={20} filled={true} />}
                size="md"
              >
                Tip Creator
              </ActionButton>
            </div>

            {/* Description */}
            {video.description && (
              <p className="text-gray-300 mb-4 leading-relaxed">{video.description}</p>
            )}

            {/* Tags */}
            {video.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {video.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/?search=${tag}`}
                    className="px-3 py-1 bg-[#EB83EA]/10 hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-full text-[#EB83EA] text-sm font-semibold transition-all"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Creator Info */}
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
            <div className="flex items-start justify-between gap-4">
              <Link href={`/profile/${video.creator.handle}`} className="flex gap-4 flex-1 group">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#EB83EA]/30 group-hover:border-[#EB83EA] transition-all flex-shrink-0">
                  <Image
                    src={video.creator.avatar}
                    alt={video.creator.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 group-hover:text-[#EB83EA] transition-colors">
                    {video.creator.displayName}
                  </h3>
                  <p className="text-gray-400 text-sm mb-1">
                    @{video.creator.handle}
                  </p>
                  <p className="text-[#EB83EA] text-sm font-semibold">
                    {(video.creator.followerCount / 1000).toFixed(1)}K followers
                  </p>
                  {video.creator.description && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                      {video.creator.description}
                    </p>
                  )}
                </div>
              </Link>
              <ActionButton
                onClick={() => setIsFollowing(!isFollowing)}
                variant={isFollowing ? "secondary" : "primary"}
                icon={<FiUserPlus className="w-5 h-5" />}
                size="md"
              >
                {isFollowing ? "Following" : "Follow"}
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Sidebar - Recommended Videos */}
        {!theaterMode && (
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h3 className="font-bold text-xl uppercase tracking-wide mb-4 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Up Next
              </h3>
              <div className="space-y-3">
                {relatedVideos.length > 0 ? (
                  relatedVideos.map((v) => (
                    <Link
                      key={v.id}
                      href={`/watch/${v.id}`}
                      className="flex gap-3 p-3 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] hover:from-[#2f2942] hover:to-[#18122D] rounded-2xl border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all shadow-lg hover:shadow-xl hover:shadow-[#EB83EA]/10 group"
                    >
                      <div className="relative w-32 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-[#EB83EA]/20">
                        <Image
                          src={v.thumbnail || `https://api.dicebear.com/9.x/shapes/svg?seed=${v.id}`}
                          alt={v.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-[#EB83EA] transition-colors">
                          {v.title}
                        </h4>
                        <p className="text-xs text-gray-400 mb-1">
                          {v.creator?.displayName || "Unknown"}
                        </p>
                        <p className="text-xs text-[#EB83EA] font-semibold">
                          {(v.views / 1000).toFixed(1)}K views
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <EmptyState
                    icon="🎬"
                    title="No More Videos"
                    description="Check out more amazing content"
                    actionLabel="Browse All Videos"
                    onAction={() => window.location.href = "/videos"}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tip Modal */}
      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        creatorName={video.creator.displayName}
        creatorDID={video.creator.did}
        videoId={video.id}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
        videoVisibility={video.visibility || "public"}
        isOwner={false} // TODO: Check if current user is owner
      />
    </div>
  );
}
