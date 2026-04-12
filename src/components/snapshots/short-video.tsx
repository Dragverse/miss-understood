"use client";

import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { FiVolume2, FiVolumeX, FiHeart, FiMessageCircle, FiShare2, FiDollarSign, FiEdit2, FiTrash2, FiMoreVertical, FiAlertCircle, FiPlay } from "react-icons/fi";
import type { Video } from "@/types";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";
import { TipModal } from "@/components/video/tip-modal";
import { VideoCommentModal } from "@/components/video/video-comment-modal";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface ShortVideoProps {
  video: Video;
  isActive: boolean;
  onNext?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  initialLiked?: boolean;
  initialFollowing?: boolean;
}

export function ShortVideo({ video, isActive, onNext, onEnded, onError, initialLiked, initialFollowing }: ShortVideoProps) {
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCreator = user?.id === video.creator?.did;

  // ─── HLS.js Playback Setup ───
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const url = video.playbackUrl;
    if (!url || url.trim() === '') {
      setPlaybackError(true);
      return;
    }

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setPlaybackError(false);

    const isHLSUrl = url.includes('.m3u8');

    if (isHLSUrl && Hls.isSupported()) {
      // Non-Safari: use HLS.js
      const hls = new Hls({
        enableWorker: true,
        startLevel: -1, // Auto quality
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isActive) {
          videoEl.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("[ShortVideo] HLS error:", data.type, data.details, {
          videoId: video.id,
          url: url.substring(0, 80),
        });
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover from network error once
            hls.startLoad();
          } else {
            setPlaybackError(true);
          }
        }
      });
    } else if (isHLSUrl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: native HLS support
      videoEl.src = url;
      if (isActive) videoEl.play().catch(() => {});
    } else if (url.includes('.mp4') || url.includes('supabase.co/storage')) {
      // Direct MP4 or Supabase Storage URL
      videoEl.src = url;
      if (isActive) videoEl.play().catch(() => {});
    } else {
      // Unknown format
      console.warn("[ShortVideo] Unknown URL format:", url.substring(0, 80));
      setPlaybackError(true);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video.playbackUrl, video.id]);

  // ─── Play/Pause based on isActive ───
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
  }, [isActive]);

  // ─── Mute sync ───
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // ─── Auto-skip broken videos after 2 seconds ───
  useEffect(() => {
    if (playbackError && onError) {
      const timer = setTimeout(() => onError(), 2000);
      return () => clearTimeout(timer);
    }
  }, [playbackError, onError]);

  // ─── Close menu on outside click ───
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // ─── Like status (batch or individual) ───
  useEffect(() => {
    if (initialLiked !== undefined) {
      setIsLiked(initialLiked);
      return;
    }

    async function checkLikeStatus() {
      if (!user?.id || video.source !== "ceramic") return;
      try {
        const authToken = await getAccessToken();
        const response = await fetch(`/api/social/like?videoId=${video.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
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

  // ─── Follow status (batch or individual) ───
  useEffect(() => {
    if (initialFollowing !== undefined) {
      setIsFollowing(initialFollowing);
      return;
    }

    async function checkFollowStatus() {
      if (!user?.id || !video.creator?.did || isCreator) return;
      try {
        const authToken = await getAccessToken();
        const response = await fetch(
          `/api/social/follow?followingDID=${encodeURIComponent(video.creator.did)}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
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

  // ─── Comment count ───
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

  // ─── Handlers ───

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) {
      alert("Please sign in to like videos");
      return;
    }

    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
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
        body: JSON.stringify({ videoId: video.id, action: newLiked ? "like" : "unlike" }),
      });
      if (!response.ok) {
        setIsLiked(!newLiked);
        setLikeCount(likeCount);
      }
    } catch (error) {
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
    const url = `${window.location.origin}/snapshots?v=${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied!");
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
    window.location.href = `/upload?edit=${video.id}`;
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;

    try {
      const authToken = await getAccessToken();
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        onNext?.();
        alert("Video deleted successfully");
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

  const handleVideoClick = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause();
    } else {
      videoEl.play().catch(() => {});
    }
  };

  const hasValidPlaybackUrl = video.playbackUrl && video.playbackUrl.trim() !== '';

  return (
    <div className="flex justify-center items-center h-full w-full focus-visible:outline-none">
      <div className="bg-gray-950 flex h-full w-full items-center overflow-hidden relative">
        {hasValidPlaybackUrl ? (
          <div className="w-full h-full relative" style={{ pointerEvents: 'none' }}>
            {/* Click overlay for play/pause */}
            <div
              className="absolute inset-0 z-[1]"
              style={{ pointerEvents: 'auto' }}
              onClick={handleVideoClick}
            />

            {playbackError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#EB83EA]/20 flex items-center justify-center mb-4">
                  <FiAlertCircle className="w-8 h-8 text-[#EB83EA]" />
                </div>
                <p className="text-gray-300 font-semibold mb-2">{video.title || "Video Unavailable"}</p>
                <p className="text-gray-400 text-sm mb-4">This video cannot be played right now</p>
                <button
                  onClick={() => onNext?.()}
                  className="px-4 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white text-sm font-medium rounded-full transition"
                  style={{ pointerEvents: 'auto' }}
                >
                  Next Video
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                playsInline
                muted={isMuted}
                poster={getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', video.livepeerAssetId)}
                onEnded={() => onEnded?.()}
                onPlay={() => { setIsPlaying(true); setPlaybackError(false); }}
                onPause={() => setIsPlaying(false)}
                onError={() => setPlaybackError(true)}
              />
            )}

            {/* Top Right Controls */}
            <div className="absolute top-2 md:top-4 right-2 md:right-4 flex flex-col gap-2 z-10" style={{ pointerEvents: 'auto' }}>
              {isCreator && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={toggleMenu}
                    className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition"
                    aria-label="Video options"
                  >
                    <FiMoreVertical className="w-5 h-5 text-white" />
                  </button>
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

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <FiVolumeX className="w-5 h-5 text-white" />
                ) : (
                  <FiVolume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>

            {/* Play/Pause Indicator */}
            {!isPlaying && !playbackError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                </div>
              </div>
            )}

            {/* Interaction Buttons - Right Side */}
            <div className="absolute bottom-20 right-2 md:right-4 flex flex-col gap-3 md:gap-4 z-20" style={{ pointerEvents: 'auto' }}>
              {video.source === "ceramic" && (
                <button onClick={handleLike} className="flex flex-col items-center gap-1" aria-label={isLiked ? "Unlike" : "Like"}>
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                    <FiHeart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                  </div>
                  <span className="text-white text-xs font-semibold">{likeCount > 0 ? likeCount : ''}</span>
                </button>
              )}

              {video.source === "ceramic" && (
                <button onClick={handleComment} className="flex flex-col items-center gap-1" aria-label="Comment">
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                    <FiMessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">{commentCount > 0 ? commentCount : ''}</span>
                </button>
              )}

              {video.source !== "ceramic" && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center">
                    <FiPlay className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">{video.views > 0 ? `${(video.views / 1000).toFixed(1)}K` : ''}</span>
                </div>
              )}

              <button onClick={handleShare} className="flex flex-col items-center gap-1" aria-label="Share">
                <div className="w-12 h-12 rounded-full bg-[#2f2942]/80 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA] transition-colors">
                  <FiShare2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs font-semibold">Share</span>
              </button>

              {video.source === "ceramic" && !isCreator && video.creator?.walletAddress && (
                <button onClick={handleTip} className="flex flex-col items-center gap-1" aria-label="Send tip">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-[#EB83EA]/50">
                    <FiDollarSign className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold">Tip</span>
                </button>
              )}
            </div>

            {/* Video Info - Bottom Left with Avatar */}
            <div className="absolute bottom-4 left-2 md:left-4 right-16 md:right-20 z-20 text-white" style={{ pointerEvents: 'auto' }}>
              <div className="flex items-start gap-3">
                {/* Avatar with follow badge */}
                <div className="relative flex-shrink-0">
                  <Link
                    href={`/u/${video.creator?.handle || video.creator?.did}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg">
                      <Image
                        src={getSafeThumbnail(video.creator?.avatar || "", "/defaultpfp.png")}
                        alt={video.creator?.displayName || "Creator"}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/defaultpfp.png'; }}
                      />
                    </div>
                  </Link>
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
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isFollowing
                          ? "bg-[#2f2942] text-white border border-[#EB83EA]/50"
                          : "bg-[#EB83EA] text-white hover:bg-[#E748E6]"
                      }`}
                      aria-label={isFollowing ? "Unfollow" : "Follow"}
                    >
                      {isFollowing ? (
                        <span className="text-[10px] font-bold">✓</span>
                      ) : (
                        <span className="text-sm font-bold leading-none">+</span>
                      )}
                    </button>
                  )}
                </div>
                {/* Username + title */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${video.creator?.handle || video.creator?.did}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold text-sm hover:underline block truncate"
                  >
                    @{video.creator?.handle || video.creator?.displayName || 'Unknown'}
                  </Link>
                  <p className="text-sm line-clamp-2 mt-0.5">{video.title}</p>
                </div>
              </div>
            </div>

            {/* Error Overlay */}
            {playbackError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                <div className="text-center text-white p-6 max-w-sm">
                  <FiAlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="text-lg font-semibold mb-2">Unable to play video</p>
                  <p className="text-sm text-white/70 mb-4">Skipping to next video...</p>
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
          </div>
        )}
      </div>

      <VideoCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
      />

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
