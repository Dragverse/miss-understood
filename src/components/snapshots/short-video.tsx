"use client";

import { useState, useRef, useEffect } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiVolume2, FiVolumeX, FiHeart, FiMessageCircle, FiShare2, FiDollarSign, FiEdit2, FiTrash2, FiMoreVertical, FiAlertCircle, FiPlay } from "react-icons/fi";
import type { Video } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/utils/video-helpers";
import { TipModal } from "@/components/video/tip-modal";
import { VideoCommentModal } from "@/components/video/video-comment-modal";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface ShortVideoProps {
  video: Video;
  isActive: boolean;
  onNext?: () => void;
  onEnded?: () => void;
  initialLiked?: boolean;
  initialFollowing?: boolean;
}

export function ShortVideo({ video, isActive, onNext, onEnded, initialLiked, initialFollowing }: ShortVideoProps) {
  const { user, getAccessToken } = usePrivy();
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const playerRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if current user is the creator
  const isCreator = user?.id === video.creator?.did;

  // Check if video is from YouTube (external)
  const isYouTubeVideo = video.playbackUrl ? isYouTubeUrl(video.playbackUrl) : false;

  // Reset error state when video changes
  useEffect(() => {
    setPlaybackError(false);
  }, [video.id]);

  // Check initial like status on mount (or use batch-fetched value)
  useEffect(() => {
    // If initialLiked prop provided (from batch check), use it directly
    if (initialLiked !== undefined) {
      setIsLiked(initialLiked);
      return;
    }

    // Otherwise, fall back to individual API call
    async function checkLikeStatus() {
      if (!user?.id || video.source !== "ceramic") return;

      try {
        const authToken = await getAccessToken();
        const response = await fetch(
          `/api/social/like?videoId=${video.id}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.liked || false);
        }
      } catch (error) {
        console.error("[ShortVideo] Failed to check like status:", error);
      }
    }

    checkLikeStatus();
  }, [video.id, user?.id, getAccessToken, video.source, initialLiked]);

  // Check follow status on mount (or use batch-fetched value)
  useEffect(() => {
    // If initialFollowing prop provided (from batch check), use it directly
    if (initialFollowing !== undefined) {
      setIsFollowing(initialFollowing);
      return;
    }

    // Otherwise, fall back to individual API call
    async function checkFollowStatus() {
      if (!user?.id || !video.creator?.did || isCreator) return;

      try {
        const authToken = await getAccessToken();
        const response = await fetch(
          `/api/social/follow?followingDID=${encodeURIComponent(video.creator.did)}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.following || false);
        }
      } catch (error) {
        console.error("[ShortVideo] Failed to check follow status:", error);
      }
    }

    checkFollowStatus();
  }, [video.creator?.did, user?.id, isCreator, getAccessToken, initialFollowing]);

  // Fetch comment count on mount
  useEffect(() => {
    async function fetchCommentCount() {
      if (video.source !== "ceramic") return;

      try {
        const response = await fetch(`/api/comments?videoId=${video.id}`);
        if (response.ok) {
          const data = await response.json();
          setCommentCount(data.comments?.length || 0);
        }
      } catch (error) {
        console.error("[ShortVideo] Failed to fetch comments:", error);
      }
    }

    fetchCommentCount();
  }, [video.id, video.source]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user?.id) {
      alert("Please sign in to like videos");
      return;
    }

    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;

    // Optimistic update
    setIsLiked(newLiked);
    setLikeCount(newCount);

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
        setLikeCount(likeCount);
      }
    } catch (error) {
      // Revert on error
      setIsLiked(!newLiked);
      setLikeCount(likeCount);
      console.error("[ShortVideo] Like error:", error);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentModalOpen(true);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: video.description,
        url: video.externalUrl || window.location.href,
      }).catch(() => {});
    }
  };

  const handleTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTipModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    // Navigate to edit page
    window.location.href = `/upload?edit=${video.id}`;
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);

    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    try {
      const authToken = await getAccessToken();
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Move to next video and refresh the list
        onNext?.();
        alert("Video deleted successfully");
        // Refresh page after a short delay
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await response.json();
        alert(`Failed to delete video: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("[ShortVideo] Delete error:", error);
      alert("Failed to delete video. Please try again.");
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Listen for play/pause events from the video element
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handlePlay = () => {
      setIsPlaying(true);
      // Clear error state when video successfully plays
      setPlaybackError(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      }
    };

    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, [onEnded]);

  // Control play/pause based on isActive prop
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isActive) {
      player.play().catch(() => {
        // Autoplay may be blocked by browser
      });
    } else {
      player.pause();
    }
  }, [isActive]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVideoClick = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Validate playback URL before rendering
  const hasValidPlaybackUrl = video.playbackUrl && video.playbackUrl.trim() !== '';

  // Check if URL is HLS/MP4 (Livepeer compatible)
  const isHLSUrl = video.playbackUrl && (
    video.playbackUrl.includes('.m3u8') ||
    video.playbackUrl.includes('livepeer') ||
    video.playbackUrl.includes('av.bsky.social') || // Bluesky native video CDN
    video.playbackUrl.includes('.mp4') ||
    video.playbackUrl.startsWith('ipfs://') // IPFS URLs
  );

  // Determine which player to use
  // Only use Livepeer for confirmed HLS URLs, not YouTube, and not generic HTTP URLs
  const canPlayWithLivepeer = hasValidPlaybackUrl && isHLSUrl && !isYouTubeVideo;

  // Enhanced logging for debugging playback issues
  useEffect(() => {
    if (!hasValidPlaybackUrl) {
      console.error('[ShortVideo] ❌ No playback URL:', {
        videoId: video.id,
        title: video.title?.substring(0, 50),
        livepeerAssetId: video.livepeerAssetId,
        playbackUrl: video.playbackUrl,
        source: video.source
      });
    } else if (!isHLSUrl && !isYouTubeVideo) {
      console.warn('[ShortVideo] ⚠️ Unsupported video format:', {
        videoId: video.id,
        title: video.title?.substring(0, 50),
        playbackUrl: video.playbackUrl?.substring(0, 100),
        isHLSUrl,
        isYouTubeVideo,
        source: video.source
      });
    } else {
      console.log('[ShortVideo] ✓ Video loaded:', {
        videoId: video.id,
        title: video.title?.substring(0, 50),
        canPlayWithLivepeer,
        isYouTubeVideo
      });
    }
  }, [video.id, hasValidPlaybackUrl, isHLSUrl, isYouTubeVideo, canPlayWithLivepeer, video.title, video.playbackUrl, video.livepeerAssetId, video.source]);

  return (
    <div className="keen-slider__slide flex justify-center items-center focus-visible:outline-none">
      <div className="bg-gray-950 flex h-full w-full md:w-[420px] md:max-h-[90vh] md:rounded-3xl items-center overflow-hidden relative md:shadow-2xl md:shadow-black/50">
        {hasValidPlaybackUrl ? (
          <div className="w-full h-full relative" style={{ pointerEvents: 'none' }}>
            <div
              className="absolute inset-0 z-[1]"
              style={{ pointerEvents: 'auto' }}
              onClick={!isYouTubeVideo ? handleVideoClick : undefined}
            />
            {playbackError ? (
              // Show error UI when playback fails
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#EB83EA]/20 flex items-center justify-center mb-4">
                  <FiAlertCircle className="w-8 h-8 text-[#EB83EA]" />
                </div>
                <p className="text-gray-300 font-semibold mb-2">{video.title || "Video Unavailable"}</p>
                <p className="text-gray-400 text-sm mb-4">
                  {!video.playbackUrl
                    ? "This video is missing playback information"
                    : "This video cannot be played right now"}
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  {!video.playbackUrl
                    ? "The video may still be processing or was not uploaded correctly"
                    : "Try refreshing the page or skip to the next video"}
                </p>
                <button
                  onClick={() => onNext?.()}
                  className="px-4 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white text-sm font-medium rounded-full transition"
                >
                  Next Video
                </button>
              </div>
            ) : isYouTubeVideo ? (
              // YouTube iframe embed for external content
              <iframe
                ref={iframeRef}
                src={getYouTubeEmbedUrl(video.playbackUrl) || video.playbackUrl}
                className="h-full w-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={video.title}
              />
            ) : canPlayWithLivepeer ? (
              // Livepeer Player for HLS streams (Dragverse, Bluesky native)
              <Player.Root
                src={getSrc(video.playbackUrl)}
                aspectRatio={9 / 16}
                volume={isMuted ? 0 : 1}
                onError={(error) => {
                  console.error("[ShortVideo] Livepeer playback error:", error);
                  console.error("[ShortVideo] Failed video details:", {
                    videoId: video.id,
                    title: video.title?.substring(0, 50),
                    playbackUrl: video.playbackUrl,
                    livepeerAssetId: video.livepeerAssetId,
                    source: video.source
                  });
                  // Show error UI after failed playback attempt
                  setPlaybackError(true);
                }}
              >
                <Player.Container className="h-full w-full">
                  <Player.Poster
                    className="object-cover"
                    src={getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', video.livepeerAssetId)}
                  />
                  <Player.Video
                    ref={playerRef}
                    className="h-full w-full object-cover"
                    loop
                    playsInline
                    muted={isMuted}
                  />
                </Player.Container>
              </Player.Root>
            ) : (
              // Unsupported format - show error UI
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#EB83EA]/20 flex items-center justify-center mb-4">
                  <FiAlertCircle className="w-8 h-8 text-[#EB83EA]" />
                </div>
                <p className="text-gray-300 font-semibold mb-2">{video.title || "Video Unavailable"}</p>
                <p className="text-gray-400 text-sm mb-4">This video format is not supported</p>
                {video.externalUrl && (
                  <a
                    href={video.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white text-sm font-medium rounded-full transition"
                  >
                    View on {video.source === 'bluesky' ? 'Bluesky' : video.source === 'youtube' ? 'YouTube' : 'Original Platform'}
                  </a>
                )}
              </div>
            )}

            {/* Top Right Controls */}
            <div className="absolute top-2 md:top-4 right-2 md:right-4 flex flex-col gap-2 z-10" style={{ pointerEvents: 'auto' }}>
              {/* Creator Menu Button */}
              {isCreator && (
                <div className="relative">
                  <button
                    onClick={toggleMenu}
                    className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition"
                  >
                    <FiMoreVertical className="w-5 h-5 text-white" />
                  </button>

                  {/* Dropdown Menu */}
                  {showMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a0b2e] border border-[#EB83EA]/20 rounded-xl shadow-xl overflow-hidden">
                      <button
                        onClick={handleEdit}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#EB83EA]/10 transition text-left"
                      >
                        <FiEdit2 className="w-4 h-4 text-[#EB83EA]" />
                        <span className="text-white text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition text-left border-t border-[#EB83EA]/10"
                      >
                        <FiTrash2 className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mute/Unmute Button - Only show for non-YouTube videos */}
              {!isYouTubeVideo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition"
                >
                  {isMuted ? (
                    <FiVolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <FiVolume2 className="w-5 h-5 text-white" />
                  )}
                </button>
              )}

              {/* YouTube indicator */}
              {isYouTubeVideo && (
                <div className="px-3 py-2 bg-black/50 rounded-full text-white/70 text-xs font-medium">
                  YouTube
                </div>
              )}
            </div>

            {/* Play/Pause Indicator - Only show for non-YouTube videos */}
            {!isPlaying && !isYouTubeVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                </div>
              </div>
            )}

            {/* Interaction Buttons - Right Side */}
            <div className="absolute bottom-20 right-2 md:right-4 flex flex-col gap-3 md:gap-4 z-20" style={{ pointerEvents: 'auto' }}>
              {/* Creator Avatar with Follow Button */}
              {video.creator?.avatar && (
                <div className="relative flex flex-col items-center gap-2">
                  <Link
                    href={`/u/${video.creator.handle || video.creator.did}`}
                    onClick={(e) => e.stopPropagation()}
                    className="relative"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg">
                      <Image
                        src={getSafeThumbnail(video.creator.avatar, "/defaultpfp.png")}
                        alt={video.creator.displayName || "Creator"}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    </div>
                  </Link>

                  {/* Follow Button - Only show for non-creators */}
                  {!isCreator && user?.id && video.source === "ceramic" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!video.creator?.did) return;

                        const newFollowing = !isFollowing;
                        setIsFollowing(newFollowing);

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
                            setIsFollowing(!newFollowing);
                          } else {
                            window.dispatchEvent(new CustomEvent('followStateChanged'));
                          }
                        } catch (error) {
                          setIsFollowing(!newFollowing);
                          console.error("[ShortVideo] Follow error:", error);
                        }
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isFollowing
                          ? "bg-[#2f2942] text-white border border-[#EB83EA]/50"
                          : "bg-[#EB83EA] text-white hover:bg-[#E748E6]"
                      }`}
                      aria-label={isFollowing ? "Unfollow" : "Follow"}
                    >
                      {isFollowing ? (
                        <span className="text-xs font-bold">✓</span>
                      ) : (
                        <span className="text-lg font-bold leading-none">+</span>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Like Button - Only for Dragverse videos */}
              {video.source === "ceramic" && (
                <button
                  onClick={handleLike}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                    <FiHeart
                      className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                    />
                  </div>
                  <span className="text-white text-xs font-semibold">{likeCount > 0 ? likeCount : ''}</span>
                </button>
              )}

              {/* Comment Button - Only for Dragverse videos */}
              {video.source === "ceramic" && (
                <button
                  onClick={handleComment}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                    <FiMessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">{commentCount > 0 ? commentCount : ''}</span>
                </button>
              )}

              {/* View Count - For external videos */}
              {video.source !== "ceramic" && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center">
                    <FiPlay className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">{video.views > 0 ? `${(video.views / 1000).toFixed(1)}K` : ''}</span>
                </div>
              )}

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                  <FiShare2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs font-semibold">Share</span>
              </button>

              {/* Tip Button */}
              {video.source === "ceramic" && !isCreator && video.creator?.walletAddress && (
                <button
                  onClick={handleTip}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-[#EB83EA]/50">
                    <FiDollarSign className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">Tip</span>
                </button>
              )}
            </div>

            {/* Video Info - Bottom Left */}
            <div className="absolute bottom-4 left-2 md:left-4 right-16 md:right-20 z-20 text-white" style={{ pointerEvents: 'auto' }}>
              <Link
                href={`/u/${video.creator?.handle || video.creator?.did}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-sm mb-2 hover:underline block"
              >
                @{video.creator?.handle || video.creator?.displayName || 'Unknown'}
              </Link>
              <p className="text-sm line-clamp-2 mb-2">{video.title}</p>
              {video.description && (
                <p className="text-xs text-gray-300 line-clamp-2">{video.description}</p>
              )}
            </div>

            {/* Error Overlay */}
            {playbackError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                <div className="text-center text-white p-6 max-w-sm">
                  <FiAlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="text-lg font-semibold mb-2">Unable to play video</p>
                  <p className="text-sm text-white/70 mb-4">
                    This video may be unavailable or restricted
                  </p>
                  {video.externalUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(video.externalUrl || video.playbackUrl, "_blank");
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                    >
                      Watch on {video.source === "youtube" ? "YouTube" : video.source === "bluesky" ? "Bluesky" : "Original Site"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EB83EA]/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#EB83EA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-300 font-semibold mb-2">{video.title || "Video Unavailable"}</p>
            <p className="text-gray-400 text-sm">This video cannot be played</p>
            {video.externalUrl && (
              <a
                href={video.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white text-sm font-medium rounded-full transition"
              >
                View on {video.source === 'bluesky' ? 'Bluesky' : video.source === 'youtube' ? 'YouTube' : 'Original Platform'}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Comment Modal */}
      <VideoCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
      />

      {/* Tip Modal */}
      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        creatorName={video.creator?.displayName || "Creator"}
        creatorDID={video.creator?.did || ""}
        videoId={video.id}
      />
    </div>
  );
}
