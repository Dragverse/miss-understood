"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiShare2, FiClock, FiPlay } from "react-icons/fi";
import Hls from "hls.js";
import { getVideo } from "@/lib/supabase/videos";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import { getSafeThumbnail, getSafeAvatar } from "@/lib/utils/thumbnail-helpers";
import { LoadingShimmer } from "@/components/shared";
import { PremiereCommentPanel } from "@/components/premiere/comment-panel";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import type { Video } from "@/types";
import toast from "react-hot-toast";

type Phase = "countdown" | "watching" | "ended";

function getTimeRemaining(targetDate: Date) {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

function isAudioContent(contentType: string | undefined): boolean {
  return contentType === "music" || contentType === "podcast";
}

export default function PremierePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  // Video player refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Audio player for music/podcast premieres
  const { playTrack, isPlaying: audioIsPlaying, currentTrack } = useAudioPlayer();

  // Fetch video data
  useEffect(() => {
    async function loadVideo() {
      try {
        const videoDoc = await getVideo(resolvedParams.id);
        if (!videoDoc) {
          setIsLoading(false);
          return;
        }

        const formatted = await transformVideoWithCreator(videoDoc);

        // No premiere mode or already cleared by cron → watch page
        if (!formatted.premiereMode || formatted.premiereMode !== "countdown") {
          window.location.href = `/watch/${resolvedParams.id}`;
          return;
        }

        // If publishedAt is in the past, user arrived late → go straight to watching
        if (formatted.publishedAt && new Date(formatted.publishedAt) <= new Date()) {
          setPhase("watching");
        }

        setVideo(formatted);
        if (formatted.publishedAt) {
          setCountdown(getTimeRemaining(new Date(formatted.publishedAt)));
        }
      } catch (error) {
        console.error("[Premiere] Failed to load video:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadVideo();
  }, [resolvedParams.id]);

  // Countdown timer — transitions to watching phase when expired
  useEffect(() => {
    if (phase !== "countdown" || !video?.publishedAt) return;

    const targetDate = new Date(video.publishedAt);
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(targetDate);
      setCountdown(remaining);

      if (remaining.expired) {
        clearInterval(interval);
        setPhase("watching");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, video?.publishedAt]);

  // ─── HLS.js Video Playback (watching phase) ───
  useEffect(() => {
    if (phase !== "watching" || !video) return;
    if (isAudioContent(video.contentType)) return; // Audio uses AudioPlayerContext

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const url = video.playbackUrl;
    if (!url || url.trim() === "") return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHLSUrl = url.includes(".m3u8");

    if (isHLSUrl && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("[Premiere] HLS error:", data.type, data.details);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
    } else if (isHLSUrl && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    } else {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [phase, video]);

  // ─── Audio Playback (music/podcast watching phase) ───
  useEffect(() => {
    if (phase !== "watching" || !video) return;
    if (!isAudioContent(video.contentType)) return;

    // Play the audio track
    playTrack({
      id: video.id,
      title: video.title,
      artist: video.creator?.displayName || "Unknown",
      thumbnail: getSafeThumbnail(video.thumbnail, video.livepeerAssetId),
      audioUrl: video.playbackUrl,
      type: "uploaded",
    });
  }, [phase, video]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect audio ended → transition to ended phase
  useEffect(() => {
    if (phase !== "watching" || !video) return;
    if (!isAudioContent(video.contentType)) return;

    // If audio was playing our track and stopped, it ended
    if (currentTrack?.id === video.id && !audioIsPlaying) {
      // Small delay to avoid false positive on initial load
      const timeout = setTimeout(() => {
        if (!audioIsPlaying && currentTrack?.id === video.id) {
          setPhase("ended");
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [audioIsPlaying, currentTrack?.id, phase, video]);

  const handleVideoEnded = useCallback(() => {
    setPhase("ended");
  }, []);

  const handleShare = async () => {
    const url = `${window.location.origin}/premiere/${resolvedParams.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Premiere link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // ─── Loading State ───
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <LoadingShimmer aspectRatio="video" className="mb-6" />
          <LoadingShimmer lines={3} />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Premiere not found</p>
          <Link href="/" className="text-[#EB83EA] hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  // ─── COUNTDOWN PHASE ───
  if (phase === "countdown") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Blurred thumbnail background */}
        <div className="absolute inset-0 z-0">
          <Image
            src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
            alt=""
            fill
            className="object-cover blur-3xl opacity-20 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f071a]/80 via-[#0f071a]/60 to-[#0f071a]" />
        </div>

        <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
          {/* Creator Info */}
          <div className="flex items-center justify-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#EB83EA]/40">
              <Image
                src={getSafeAvatar(video.creator?.avatar, "/defaultpfp.png")}
                alt={video.creator?.displayName || "Creator"}
                fill
                className="object-cover"
              />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">{video.creator?.displayName}</p>
              <p className="text-sm text-gray-400">@{video.creator?.handle}</p>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#EB83EA]/30 shadow-2xl shadow-[#EB83EA]/10">
            <Image
              src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
              alt={video.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#EB83EA]/30 backdrop-blur-sm flex items-center justify-center border border-[#EB83EA]/50">
                <FiClock className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#EB83EA] mb-2">
              Premiering Soon
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-white">{video.title}</h1>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            {countdown.days > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.days)}</span>
                </div>
                <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Days</span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.hours)}</span>
              </div>
              <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Hours</span>
            </div>
            <div className="text-2xl font-bold text-[#EB83EA] self-start mt-6">:</div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.minutes)}</span>
              </div>
              <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Minutes</span>
            </div>
            <div className="text-2xl font-bold text-[#EB83EA] self-start mt-6">:</div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center animate-pulse">
                <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.seconds)}</span>
              </div>
              <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Seconds</span>
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition-all hover:scale-105 transform"
          >
            <FiShare2 className="w-5 h-5" />
            Share Premiere
          </button>

          {/* Scheduled date */}
          {video.publishedAt && (
            <p className="text-sm text-gray-400">
              Drops{" "}
              {new Date(video.publishedAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── WATCHING PHASE ───
  if (phase === "watching") {
    const isAudio = isAudioContent(video.contentType);

    return (
      <div className="min-h-[80vh] px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* PREMIERING NOW badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Premiering Now
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Player (2/3) */}
            <div className="lg:col-span-2">
              {isAudio ? (
                /* Audio premiere: large album art */
                <div className="relative aspect-square max-w-md mx-auto rounded-2xl overflow-hidden border border-[#EB83EA]/30 shadow-2xl shadow-[#EB83EA]/10 mb-6">
                  <Image
                    src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-bold text-lg">{video.title}</p>
                    <p className="text-gray-300 text-sm">{video.creator?.displayName}</p>
                  </div>
                </div>
              ) : (
                /* Video premiere: HLS player */
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                    autoPlay
                    onEnded={handleVideoEnded}
                  />
                </div>
              )}

              {/* Video info below player */}
              <div className="mt-4 space-y-3">
                <h1 className="text-xl lg:text-2xl font-bold text-white">{video.title}</h1>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/u/${video.creator?.handle}`}
                    className="flex items-center gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#EB83EA]/40">
                      <Image
                        src={getSafeAvatar(video.creator?.avatar, "/defaultpfp.png")}
                        alt={video.creator?.displayName || "Creator"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-white group-hover:text-[#EB83EA] transition-colors">
                        {video.creator?.displayName}
                      </p>
                      <p className="text-xs text-gray-400">@{video.creator?.handle}</p>
                    </div>
                  </Link>
                  <button
                    onClick={handleShare}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm text-gray-300 transition"
                  >
                    <FiShare2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
                {video.description && (
                  <p className="text-sm text-gray-400 line-clamp-3">{video.description}</p>
                )}
              </div>
            </div>

            {/* Right: Live Chat (1/3) */}
            <div className="lg:col-span-1">
              <PremiereCommentPanel videoId={video.id} active={true} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ENDED PHASE ───
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Blurred background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
          alt=""
          fill
          className="object-cover blur-3xl opacity-15 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f071a]/80 via-[#0f071a]/60 to-[#0f071a]" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[#EB83EA]/20 border border-[#EB83EA]/30 flex items-center justify-center mx-auto">
          <FiPlay className="w-10 h-10 text-[#EB83EA]" />
        </div>

        <h2 className="text-3xl font-bold text-white">Premiere Complete!</h2>
        <p className="text-gray-400">
          Thanks for watching &ldquo;{video.title}&rdquo;
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/watch/${video.id}`}
            className="px-8 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition-all hover:scale-105"
          >
            Rewatch on Dragverse
          </Link>
          <Link
            href={`/u/${video.creator?.handle}`}
            className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full font-semibold transition"
          >
            Visit {video.creator?.displayName}
          </Link>
        </div>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
        >
          <FiShare2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}
