"use client";

import { useState, useRef, useEffect } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiVolume2, FiVolumeX, FiHeart, FiMessageCircle, FiShare2, FiDollarSign, FiEdit2, FiTrash2, FiMoreVertical, FiAlertCircle } from "react-icons/fi";
import type { Video } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/utils/video-helpers";

interface ShortVideoProps {
  video: Video;
  isActive: boolean;
  onNext?: () => void;
  onEnded?: () => void;
}

export function ShortVideo({ video, isActive, onNext, onEnded }: ShortVideoProps) {
  const { user } = usePrivy();
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
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

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    // TODO: Call API to update like status
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Open comment modal or navigate to post page
    console.log("Comment clicked");
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Open share modal
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
    // TODO: Open tip modal
    console.log("Tip clicked");
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    // TODO: Navigate to edit page or open edit modal
    console.log("Edit video:", video.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm("Are you sure you want to delete this video?")) {
      // TODO: Call delete API
      console.log("Delete video:", video.id);
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

  // Log for debugging
  if (hasValidPlaybackUrl && !isYouTubeVideo && !canPlayWithLivepeer) {
    console.log('[ShortVideo] Video will use fallback UI:', {
      id: video.id,
      title: video.title?.substring(0, 50),
      playbackUrl: video.playbackUrl?.substring(0, 100),
      isHLSUrl,
      isYouTubeVideo,
      source: video.source
    });
  }

  return (
    <div className="keen-slider__slide flex snap-center justify-center focus-visible:outline-none md:ml-16 md:pb-2">
      <div className="rounded-large ultrawide:w-[650px] bg-gray-950 flex h-full w-[calc(100vw-80px)] items-center overflow-hidden md:w-[450px] relative">
        {hasValidPlaybackUrl ? (
          <div className="w-full h-full relative" onClick={!isYouTubeVideo ? handleVideoClick : undefined}>
            {isYouTubeVideo ? (
              // YouTube iframe embed for external content
              <iframe
                ref={iframeRef}
                src={getYouTubeEmbedUrl(video.playbackUrl) || video.playbackUrl}
                className="h-full w-full object-contain"
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
                  // Log error but don't show overlay for Livepeer playback issues
                  // These are often transient (still processing, CORS, etc)
                  console.warn("[ShortVideo] Livepeer playback error (non-blocking):", {
                    error,
                    videoId: video.id,
                    title: video.title?.substring(0, 50),
                    playbackUrl: video.playbackUrl?.substring(0, 100),
                    source: video.source
                  });
                  // Only show error overlay for persistent issues
                  // Don't block playback for transient Livepeer errors
                }}
              >
                <Player.Container className="h-full w-full">
                  <Player.Video
                    ref={playerRef}
                    className="h-full w-full object-contain"
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
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
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
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                </div>
              </div>
            )}

            {/* Interaction Buttons - Right Side */}
            <div className="absolute bottom-20 right-4 flex flex-col gap-4 z-20">
              {/* Creator Avatar */}
              {video.creator?.avatar && (
                <Link
                  href={`/profile/${video.creator.handle || video.creator.did}`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg">
                    <Image
                      src={video.creator.avatar}
                      alt={video.creator.displayName || "Creator"}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                </Link>
              )}

              {/* Like Button */}
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

              {/* Comment Button */}
              <button
                onClick={handleComment}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                  <FiMessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs font-semibold">{video.creator?.followerCount || 0}</span>
              </button>

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

              {/* Tip Button - Only for Dragverse creators */}
              {video.source === "ceramic" && (
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
            <div className="absolute bottom-4 left-4 right-20 z-20 text-white">
              <Link
                href={`/profile/${video.creator?.handle || video.creator?.did}`}
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
    </div>
  );
}
