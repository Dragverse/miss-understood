"use client";

import React, { useState, useEffect } from "react";
import { mockVideos } from "@/lib/utils/mock-data";
import Image from "next/image";
import Link from "next/link";
import { FiMessageCircle, FiShare2, FiUserPlus, FiLock, FiMaximize2, FiMinimize2, FiPlay, FiPause, FiVolume2, FiVolumeX } from "react-icons/fi";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
// import { TipModal } from "@/components/video/tip-modal"; // Hidden until monetization feature
import { ShareModal } from "@/components/video/share-modal";
import { VideoCommentModal } from "@/components/video/video-comment-modal";
import { VideoOptionsMenu } from "@/components/video/video-options-menu";
// import { ChocolateBar } from "@/components/ui/chocolate-bar"; // Hidden until monetization feature
import { getVideo, getVideos, incrementVideoViews, type SupabaseVideo } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { USE_MOCK_DATA } from "@/lib/config/env";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import { usePrivy } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { HeartAnimation, ActionButton, EmptyState, LoadingShimmer, MoodBadge, TipButton } from "@/components/shared";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/utils/video-helpers";
import { createMinimalYouTubeVideoWithDetection } from "@/lib/youtube/video-helpers";
import { getSafeThumbnail, isValidPlaybackUrl } from "@/lib/utils/thumbnail-helpers";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("token");
  const { getAccessToken, login, user } = usePrivy();
  const { pause: pauseAudio, isPlaying: isAudioPlaying } = useAudioPlayer();

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  // const [tipModalOpen, setTipModalOpen] = useState(false); // Hidden until monetization feature
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [creatorVideos, setCreatorVideos] = useState<Video[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);

  const isOwner = !!(user?.id && video?.creator?.did && video.creator.did === user.id);

  // Initialize like and follow states from API
  useEffect(() => {
    async function checkUserInteractions() {
      if (!user?.id || !video?.id) return;

      try {
        const authToken = await getAccessToken();

        // Check if user has liked the video
        const likeResponse = await fetch(`/api/social/like?videoId=${video.id}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (likeResponse.ok) {
          const likeData = await likeResponse.json();
          setIsLiked(likeData.liked || false);
        }

        // Check if user is following the creator
        if (video.creator.did) {
          const followResponse = await fetch(`/api/social/follow?followingDID=${video.creator.did}`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          if (followResponse.ok) {
            const followData = await followResponse.json();
            setIsFollowing(followData.following || false);
          }
        }
      } catch (error) {
        console.error("[Watch] Failed to check user interactions:", error);
      }
    }

    checkUserInteractions();
  }, [user?.id, video?.id, video?.creator.did]);

  // Pause audio when video page loads or when video is playing
  useEffect(() => {
    if (video && isAudioPlaying) {
      console.log("[Watch] Pausing audio player because video is being watched");
      pauseAudio();
    }
  }, [video, isAudioPlaying, pauseAudio]);

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
        // Check if this is a YouTube video (ID starts with "youtube-")
        if (resolvedParams.id.startsWith("youtube-")) {
          console.log("[Watch] Loading YouTube video from RSS feed:", resolvedParams.id);

          try {
            // Try to fetch from YouTube RSS feed (no limit to get all videos)
            // This ensures we find videos even if they're not in the most recent 100
            const response = await fetch("/api/youtube/feed?rssOnly=true");
            const data = await response.json();

            if (data.success && data.videos) {
              const youtubeVideo = data.videos.find((v: Video) => v.id === resolvedParams.id);

              if (youtubeVideo) {
                console.log("[Watch] Found YouTube video in feed:", youtubeVideo.title);
                setVideo(youtubeVideo);
                setLikes(0); // YouTube videos don't have Dragverse likes
                setAccessDenied(false);
                setIsLoading(false);
                return;
              }
            }

            // Fallback: Create minimal video with detection for immediate playback
            // This allows playing any valid YouTube video even if not in our curated feed
            console.log("[Watch] YouTube video not in feed, creating minimal video for playback");
            const youtubeVideo = await createMinimalYouTubeVideoWithDetection(resolvedParams.id);

            setVideo(youtubeVideo);
            setLikes(0);
            setAccessDenied(false);
            setIsLoading(false);
            return;
          } catch (error) {
            console.error("[Watch] Failed to load YouTube video:", error);
            setAccessDenied(true);
            setAccessDeniedReason("This YouTube video could not be loaded. It may be private or removed.");
            setIsLoading(false);
            return;
          }
        }

        // Check if this is a Bluesky video (ID starts with "bluesky-")
        if (resolvedParams.id.startsWith("bluesky-")) {
          console.log("[Watch] Loading Bluesky video:", resolvedParams.id);

          // Fetch from Bluesky feed API
          const response = await fetch("/api/bluesky/feed?limit=30");
          const data = await response.json();

          if (data.posts) {
            const blueskyVideo = data.posts.find((v: Video) => v.id === resolvedParams.id);

            if (blueskyVideo) {
              setVideo(blueskyVideo);
              setLikes(blueskyVideo.likes || 0);
              setAccessDenied(false);
              setIsLoading(false);
              return;
            }
          }

          // Video not found in Bluesky feed
          setAccessDenied(true);
          setAccessDeniedReason("Bluesky video not found");
          setIsLoading(false);
          return;
        }

        // For Dragverse videos, check access via API (includes privacy check)
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

        // Access granted - transform video data with proper creator info
        const ceramicVideo = accessData.video as SupabaseVideo;
        const formattedVideo = await transformVideoWithCreator(ceramicVideo);

        // Redirect to listen page if this is audio content
        if (formattedVideo.contentType === 'podcast' || formattedVideo.contentType === 'music') {
          console.log("[Watch] Redirecting audio content to /listen page");
          window.location.href = `/listen/${resolvedParams.id}${shareToken ? `?token=${shareToken}` : ''}`;
          return;
        }

        setVideo(formattedVideo);
        setLikes(formattedVideo.likes);
        setAccessDenied(false);

        // Increment view count for Dragverse videos only (with unique tracking)
        if (formattedVideo.source === 'ceramic' && resolvedParams.id) {
          try {
            const viewerDID = user?.id || undefined;
            await incrementVideoViews(resolvedParams.id, viewerDID);
            console.log("[Watch] View count incremented for video:", resolvedParams.id, viewerDID ? "(authenticated)" : "(anonymous)");
          } catch (error) {
            console.error("[Watch] Failed to increment view count:", error);
            // Don't block page load on view count failure
          }
        }
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

  // Load related videos and creator videos in parallel
  useEffect(() => {
    async function loadRelatedAndCreatorVideos() {
      setLoadingRelated(true);
      const allVideos: Video[] = [];

      // Fetch all sources in parallel for speed
      const [ceramicResult, youtubeData, blueskyData] = await Promise.all([
        getVideos(10).catch(() => []),
        fetch("/api/youtube/feed?limit=10&rssOnly=true")
          .then(res => res.ok ? res.json() : { videos: [] })
          .catch(() => ({ videos: [] })),
        fetch("/api/bluesky/feed?limit=5")
          .then(res => res.ok ? res.json() : { posts: [] })
          .catch(() => ({ posts: [] })),
      ]);

      // Transform Supabase videos
      if (ceramicResult && ceramicResult.length > 0) {
        const transformed = ceramicResult.map(v => ({
          id: v.id,
          title: v.title,
          description: v.description || '',
          thumbnail: v.thumbnail || null,
          duration: v.duration || 0,
          views: v.views,
          likes: v.likes,
          createdAt: new Date(v.created_at),
          playbackUrl: v.playback_url || '',
          livepeerAssetId: v.playback_id || v.livepeer_asset_id || '',
          contentType: v.content_type as any || 'long',
          creator: v.creator ? {
            did: v.creator.did,
            handle: v.creator.handle,
            displayName: v.creator.display_name,
            avatar: v.creator.avatar || '/defaultpfp.png',
            verified: v.creator.verified || false,
            walletAddress: v.creator.wallet_address,
          } : { did: v.creator_did },
          category: v.category || '',
          tags: v.tags || [],
          source: 'ceramic' as const,
        }));
        allVideos.push(...transformed as Video[]);
      }

      // Add YouTube and Bluesky
      if (youtubeData.videos) allVideos.push(...youtubeData.videos);
      if (blueskyData.posts) allVideos.push(...blueskyData.posts);
      allVideos.push(...getLocalVideos());

      // Filter videos from the same creator
      const fromCreator = allVideos.filter(v =>
        v.id !== resolvedParams.id &&
        v.creator?.did === video?.creator?.did
      ).slice(0, 5);
      setCreatorVideos(fromCreator);

      // Filter by matching content type for related videos
      const matchingContentType = allVideos.filter(v =>
        v.id !== resolvedParams.id &&
        v.contentType === video?.contentType &&
        v.creator?.did !== video?.creator?.did // Exclude creator's videos from related
      );

      // Prefer videos with same category/tags
      const related = matchingContentType
        .filter(v => {
          if (video?.category && v.category === video.category) return true;
          if (video?.tags && v.tags) {
            return video.tags.some(tag => v.tags.includes(tag));
          }
          return true;
        })
        .slice(0, 10);

      // Fill up to 10 if needed
      if (related.length < 10) {
        const additional = matchingContentType
          .filter(v => !related.includes(v))
          .slice(0, 10 - related.length);
        related.push(...additional);
      }

      setRelatedVideos(related);
      setLoadingRelated(false);
    }

    if (video) {
      loadRelatedAndCreatorVideos();
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

  const handleLike = async () => {
    if (!user?.id) {
      alert("Please sign in to like videos");
      return;
    }

    const newLiked = !isLiked;
    const newCount = newLiked ? likes + 1 : likes - 1;

    // Optimistic update
    setIsLiked(newLiked);
    setLikes(newCount);

    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/social/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          videoId: video.id,
          action: newLiked ? "like" : "unlike",
        }),
      });

      if (!response.ok) {
        // Revert on error
        setIsLiked(!newLiked);
        setLikes(likes);
        toast.error("Failed to update like. Please try again.");
      }
    } catch (error) {
      // Revert on error
      setIsLiked(!newLiked);
      setLikes(likes);
      console.error("[Watch] Like error:", error);
      toast.error("Failed to update like. Please try again.");
    }
  };

  const handleEdit = () => {
    window.location.href = `/upload?edit=${video?.id}`;
  };

  const handleDelete = async () => {
    if (!confirm("Delete this video? This action cannot be undone.")) {
      return;
    }

    try {
      const authToken = await getAccessToken();
      const response = await fetch(`/api/video/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId: video?.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      toast.success("Video deleted successfully");
      window.location.href = "/profile";
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video. Please try again.");
    }
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  return (
    <div className={`${theaterMode ? "max-w-full bg-black" : "max-w-7xl"} mx-auto px-4 py-6 transition-all duration-300`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video */}
        <div className={`${theaterMode ? "lg:col-span-3" : "lg:col-span-2"} transition-all duration-300`}>
          {/* Livepeer Player with theater mode */}
          <div className="rounded-2xl overflow-hidden mb-4 border border-[#EB83EA]/20 shadow-2xl shadow-black/50 relative group bg-black">
            {/* Theater mode toggle */}
            <button
              onClick={() => setTheaterMode(!theaterMode)}
              className="absolute top-3 right-3 z-10 p-2.5 bg-black/70 hover:bg-[#EB83EA] backdrop-blur-sm rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title={theaterMode ? "Exit theater mode" : "Enter theater mode"}
            >
              {theaterMode ? (
                <FiMinimize2 className="w-4 h-4 text-white" />
              ) : (
                <FiMaximize2 className="w-4 h-4 text-white" />
              )}
            </button>

            {isValidPlaybackUrl(video.playbackUrl) ? (
              isYouTubeUrl(video.playbackUrl) ? (
                // YouTube iframe embed - using feed page styling pattern
                <div
                  className="relative w-full rounded-xl overflow-hidden bg-[#0f071a]"
                  style={{ aspectRatio: video.contentType === "short" ? "9/16" : "16/9" }}
                >
                  <iframe
                    src={getYouTubeEmbedUrl(video.playbackUrl) || undefined}
                    className="absolute inset-0 w-full h-full rounded-xl"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={video.title}
                  />
                </div>
              ) : (
                // Livepeer Player for uploaded videos - Enhanced quality
                <Player.Root
                  src={getSrc(video.playbackUrl)}
                  aspectRatio={video.contentType === "short" ? 9 / 16 : 16 / 9}
                  autoPlay
                  volume={0.8}
                  lowLatency
                >
                  <Player.Container className="rounded-2xl overflow-hidden bg-black">
                    {/* Poster/Thumbnail while loading */}
                    <Player.Poster
                      className="object-cover"
                      src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
                    />
                    {/* Loading indicator */}
                    <Player.LoadingIndicator className="w-full h-full flex items-center justify-center bg-black/50">
                      <div className="w-16 h-16 border-4 border-[#EB83EA] border-t-transparent rounded-full animate-spin" />
                    </Player.LoadingIndicator>
                    <Player.Video
                      className={video.contentType === "short" ? "max-h-[80vh] mx-auto" : ""}
                      style={{ objectFit: "contain" }}
                    />
                    {/* Enhanced Controls */}
                    <Player.Controls autoHide={3000} className="flex flex-col justify-end">
                      {/* Progress Bar - Full width at top of controls */}
                      <div className="px-4 pb-2">
                        <Player.Seek className="w-full group">
                          <Player.Track className="h-1 group-hover:h-2 bg-white/30 rounded-full transition-all cursor-pointer">
                            <Player.SeekBuffer className="bg-white/40 rounded-full h-full" />
                            <Player.Range className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-full h-full" />
                          </Player.Track>
                          <Player.Thumb className="w-4 h-4 bg-[#EB83EA] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Player.Seek>
                      </div>

                      {/* Control Buttons Row */}
                      <div className="flex items-center gap-2 px-4 pb-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8">
                        {/* Play/Pause */}
                        <Player.PlayPauseTrigger className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[#EB83EA]/40 transition">
                          <Player.PlayingIndicator matcher={false}>
                            <FiPlay className="w-5 h-5 text-white ml-0.5" />
                          </Player.PlayingIndicator>
                          <Player.PlayingIndicator matcher={true}>
                            <FiPause className="w-5 h-5 text-white" />
                          </Player.PlayingIndicator>
                        </Player.PlayPauseTrigger>

                        {/* Volume */}
                        <div className="flex items-center gap-1 group">
                          <Player.MuteTrigger className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition">
                            <Player.VolumeIndicator matcher={false}>
                              <FiVolumeX className="w-5 h-5 text-white" />
                            </Player.VolumeIndicator>
                            <Player.VolumeIndicator matcher={true}>
                              <FiVolume2 className="w-5 h-5 text-white" />
                            </Player.VolumeIndicator>
                          </Player.MuteTrigger>
                          <Player.Volume className="w-0 group-hover:w-20 overflow-hidden transition-all duration-200">
                            <Player.Track className="h-1 bg-white/30 rounded-full cursor-pointer">
                              <Player.Range className="bg-white rounded-full h-full" />
                            </Player.Track>
                            <Player.Thumb className="w-3 h-3 bg-white rounded-full" />
                          </Player.Volume>
                        </div>

                        {/* Time Display */}
                        <Player.Time className="text-sm font-medium text-white/90 ml-2" />

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Picture in Picture */}
                        <Player.PictureInPictureTrigger className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" />
                          </svg>
                        </Player.PictureInPictureTrigger>

                        {/* Fullscreen */}
                        <Player.FullscreenTrigger className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition">
                          <Player.FullscreenIndicator matcher={false}>
                            <FiMaximize2 className="w-5 h-5 text-white" />
                          </Player.FullscreenIndicator>
                          <Player.FullscreenIndicator matcher={true}>
                            <FiMinimize2 className="w-5 h-5 text-white" />
                          </Player.FullscreenIndicator>
                        </Player.FullscreenTrigger>
                      </div>
                    </Player.Controls>
                  </Player.Container>
                </Player.Root>
              )
            ) : (
              <div className="w-full aspect-video bg-black rounded-lg flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[#EB83EA]/20 flex items-center justify-center mb-4">
                  <FiPlay className="w-8 h-8 text-[#EB83EA]" />
                </div>
                <p className="text-white font-semibold mb-2">Video playback unavailable</p>
                <p className="text-gray-400 text-sm mb-4">This video cannot be played at this time</p>
                {video.externalUrl && (
                  <a
                    href={video.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition"
                  >
                    Watch on {video.source === 'youtube' ? 'YouTube' : video.source === 'bluesky' ? 'Bluesky' : 'Original Platform'}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-2xl p-5 border border-[#EB83EA]/20 mb-4 shadow-lg">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h1 className="text-xl lg:text-2xl font-bold mb-2 text-white">
                  {video.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                  {/* Only show view count for Dragverse videos with tracked views */}
                  {video.source === "ceramic" && video.views > 0 && (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="text-[#EB83EA] font-bold">
                          {video.views >= 1000 ? `${(video.views / 1000).toFixed(1)}K` : video.views}
                        </span> views
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {/* For external videos, show prominent source indicator */}
                  {video.source === "youtube" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600/20 border border-red-600/40 rounded-full text-xs font-bold text-red-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        FROM YOUTUBE
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {video.source === "bluesky" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 border border-blue-600/40 rounded-full text-xs font-bold text-blue-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3c-1.5 0-3 1.5-3 3v12c0 1.5 1.5 3 3 3s3-1.5 3-3V6c0-1.5-1.5-3-3-3z"/>
                        </svg>
                        FROM BLUESKY
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {video.source === "ceramic" && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600/20 border border-purple-600/40 rounded-full text-xs font-bold text-purple-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        DRAGVERSE
                      </span>
                      <span>•</span>
                    </>
                  )}
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
              {/* Options Menu - Only for Dragverse videos */}
              {video.source === "ceramic" && (
                <VideoOptionsMenu
                  video={video}
                  isOwner={isOwner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onShare={handleShare}
                />
              )}
            </div>

            {/* Stats Row */}
            {video.source === "ceramic" && video.views > 0 && (
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#EB83EA]/10">
                <div className="flex items-center gap-2 text-gray-300">
                  <FiPlay className="w-4 h-4 text-[#EB83EA]" />
                  <span className="text-sm font-medium">
                    {video.views >= 1000 ? `${(video.views / 1000).toFixed(1)}K` : video.views} views
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-sm font-medium">
                    {likes >= 1000 ? `${(likes / 1000).toFixed(1)}K` : likes} likes
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons - Improved Layout */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 mb-6">
              {/* Like Button - Only for Dragverse videos */}
              {video.source === "ceramic" && (
                <div className="col-span-2 sm:col-span-1">
                  <HeartAnimation
                    initialLiked={isLiked}
                    onToggle={handleLike}
                    showCount={false}
                    count={likes}
                  />
                </div>
              )}

              {/* Comment Button - Only for Dragverse videos */}
              {video.source === "ceramic" && (
                <button
                  onClick={() => setCommentModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-[#2f2942] hover:bg-[#3f3952] border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl font-semibold transition-all text-white hover:text-[#EB83EA] hover:scale-105 transform"
                >
                  <FiMessageCircle className="w-5 h-5" />
                  <span>Comment</span>
                </button>
              )}

              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[#2f2942] hover:bg-[#3f3952] border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl font-semibold transition-all text-white hover:text-[#EB83EA] hover:scale-105 transform"
              >
                <FiShare2 className="w-5 h-5" />
                <span>Share</span>
              </button>

              {/* Tip Button - Prominent */}
              {video.source === "ceramic" && !isOwner && video.creator.walletAddress && (
                <div className="col-span-2 sm:col-span-1 sm:ml-auto">
                  <TipButton creator={video.creator} variant="primary" size="md" className="w-full sm:w-auto hover:scale-105 transform transition-transform" />
                </div>
              )}
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
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-2xl p-5 border border-[#EB83EA]/20 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <Link href={`/u/${video.creator.handle}`} className="flex gap-3 flex-1 group">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#EB83EA]/30 group-hover:border-[#EB83EA] transition-all flex-shrink-0">
                  <Image
                    src={video.creator.avatar}
                    alt={video.creator.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg group-hover:text-[#EB83EA] transition-colors">
                      {video.creator.displayName}
                    </h3>
                    {/* YouTube Badge */}
                    {video.creator.youtubeChannelId && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600/20 border border-red-600/40 rounded-full text-xs font-bold text-red-400">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-1">
                    @{video.creator.handle}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col">
                      <p className="text-[#EB83EA] font-semibold">
                        {(() => {
                          const dragverseFollowers = video.creator.followerCount || 0;
                          const blueskyFollowers = (video.creator as any).blueskyFollowerCount || 0;
                          const youtubeFollowers = (video.creator as any).youtubeFollowerCount || 0;
                          const total = dragverseFollowers + blueskyFollowers + youtubeFollowers;
                          return total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total;
                        })()} followers
                      </p>
                      {(((video.creator as any).blueskyFollowerCount || 0) > 0 || ((video.creator as any).youtubeFollowerCount || 0) > 0) && (
                        <p className="text-xs text-gray-500">
                          {[
                            (video.creator.followerCount || 0) > 0 && `Dragverse: ${video.creator.followerCount}`,
                            ((video.creator as any).blueskyFollowerCount || 0) > 0 && `Bluesky: ${(video.creator as any).blueskyFollowerCount}`,
                            ((video.creator as any).youtubeFollowerCount || 0) > 0 && `YouTube: ${(video.creator as any).youtubeFollowerCount}`
                          ].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-600">•</span>
                    <p className="text-gray-400">
                      {video.creator.followingCount >= 1000
                        ? `${(video.creator.followingCount / 1000).toFixed(1)}K`
                        : video.creator.followingCount} following
                    </p>
                  </div>
                  {video.creator.description && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                      {video.creator.description}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-2">
                {/* YouTube Subscribe Button */}
                {video.creator.youtubeChannelId && (
                  <a
                    href={`https://www.youtube.com/channel/${video.creator.youtubeChannelId}?sub_confirmation=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold transition-all text-white"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Subscribe on YouTube
                  </a>
                )}
                {/* Dragverse Follow Button - only for non-YouTube creators and not own video */}
                {!video.creator.youtubeChannelId && !isOwner && (
                  <ActionButton
                    onClick={async () => {
                      if (!user?.id) {
                        toast.error("Please sign in to follow creators");
                        login();
                        return;
                      }

                      if (!video?.creator?.did) {
                        toast.error("Unable to follow this creator");
                        return;
                      }

                      const newFollowing = !isFollowing;
                      setIsFollowing(newFollowing); // Optimistic update

                      try {
                        const authToken = await getAccessToken();
                        const response = await fetch("/api/social/follow", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authToken}`,
                          },
                          body: JSON.stringify({
                            followingDID: video.creator.did,
                            action: newFollowing ? "follow" : "unfollow",
                          }),
                        });

                        if (!response.ok) {
                          throw new Error("Failed to update follow status");
                        }

                        toast.success(newFollowing ? `Following ${video.creator.displayName}` : `Unfollowed ${video.creator.displayName}`);
                      } catch (error) {
                        // Revert on error
                        setIsFollowing(!newFollowing);
                        console.error("[Watch] Follow error:", error);
                        toast.error("Failed to update follow status. Please try again.");
                      }
                    }}
                    variant={isFollowing ? "secondary" : "primary"}
                    icon={<FiUserPlus className="w-5 h-5" />}
                    size="md"
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Creator Videos & Recommended */}
        {!theaterMode && (
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-5">
              {/* More from Creator */}
              {creatorVideos.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide mb-3 text-[#EB83EA]">
                    More from {video.creator.displayName}
                  </h3>
                  <div className="space-y-2">
                    {creatorVideos.map((v) => {
                      // Determine correct route based on content type
                      const route = (v.contentType === 'podcast' || v.contentType === 'music') ? `/listen/${v.id}` : `/watch/${v.id}`;
                      return (
                        <Link
                          key={v.id}
                          href={route}
                          className="flex gap-2 p-2 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] hover:from-[#2f2942] hover:to-[#18122D] rounded-lg border border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all group"
                        >
                          <div className="relative w-24 h-16 flex-shrink-0 rounded overflow-hidden">
                            <Image
                              src={getSafeThumbnail(v.thumbnail, `https://api.dicebear.com/9.x/shapes/svg?seed=${v.id}`)}
                              alt={v.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-xs line-clamp-2 mb-1 group-hover:text-[#EB83EA] transition-colors">
                              {v.title}
                            </h4>
                            {v.source === "ceramic" && v.views > 0 && (
                              <p className="text-xs text-gray-500">
                                {v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}K` : v.views} views
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Up Next - Related Videos */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3 text-[#EB83EA]">
                  Up Next
                </h3>
                {loadingRelated ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 p-3 bg-[#18122D] rounded-2xl border border-[#EB83EA]/10 animate-pulse">
                        <div className="w-32 h-20 bg-[#2f2942] rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-[#2f2942] rounded w-3/4" />
                          <div className="h-3 bg-[#2f2942] rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : relatedVideos.length > 0 ? (
                  <div className="space-y-2">
                    {relatedVideos.map((v) => {
                      // Determine correct route based on content type
                      const route = (v.contentType === 'podcast' || v.contentType === 'music') ? `/listen/${v.id}` : `/watch/${v.id}`;
                      return (
                        <Link
                          key={v.id}
                          href={route}
                          className="flex gap-2 p-2.5 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] hover:from-[#2f2942] hover:to-[#18122D] rounded-lg border border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all group"
                        >
                          <div className="relative w-28 h-18 flex-shrink-0 rounded overflow-hidden">
                            <Image
                              src={getSafeThumbnail(v.thumbnail, `https://api.dicebear.com/9.x/shapes/svg?seed=${v.id}`)}
                              alt={v.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-xs line-clamp-2 mb-1 group-hover:text-[#EB83EA] transition-colors">
                              {v.title}
                            </h4>
                            <p className="text-xs text-gray-400 mb-0.5">
                              {v.creator?.displayName || "Unknown"}
                            </p>
                            {v.source === "ceramic" && v.views > 0 && (
                              <p className="text-xs text-gray-500">
                                {v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}K` : v.views} views
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
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

      {/* Tip Modal - Hidden until monetization feature is implemented
      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        creatorName={video.creator.displayName}
        creatorDID={video.creator.did}
        videoId={video.id}
      />
      */}

      {/* Comment Modal */}
      <VideoCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
        videoVisibility={video.visibility || "public"}
        isOwner={isOwner}
      />
    </div>
  );
}
