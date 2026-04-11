"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import Hls from "hls.js";
import { FiVolume2, FiVolumeX, FiSkipForward } from "react-icons/fi";
import { HeroSlider } from "./hero-slider";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface HeroSectionProps {
  horizontalVideos?: Video[];
}

export function HeroSection({ horizontalVideos }: HeroSectionProps) {
  const [streamInfo, setStreamInfo] = useState<{
    isLive: boolean;
    playbackId?: string;
    playbackUrl?: string;
  }>({
    isLive: false,
  });
  const [checkingStream, setCheckingStream] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Broadcast state (when offline + 5+ videos)
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [broadcastMuted, setBroadcastMuted] = useState(true);
  const broadcastVideoRef = useRef<HTMLVideoElement>(null);
  const broadcastHlsRef = useRef<Hls | null>(null);

  const hasBroadcast = !streamInfo.isLive && horizontalVideos && horizontalVideos.length >= 5;
  const broadcastVideo = hasBroadcast ? horizontalVideos![broadcastIndex] : null;
  const broadcastNextVideo = hasBroadcast ? horizontalVideos![(broadcastIndex + 1) % horizontalVideos!.length] : null;

  useEffect(() => {
    // Check if stream is live using backend API
    const checkStream = async () => {
      try {
        const response = await fetch("/api/stream/status/official", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        const data = await response.json();
        const wasLive = streamInfo.isLive;
        const nowLive = data.isLive || false;

        setStreamInfo({
          isLive: nowLive,
          playbackId: data.playbackId || process.env.NEXT_PUBLIC_OFFICIAL_PLAYBACK_ID || 'fb7fdq50qnczbi4u',
          playbackUrl: data.playbackUrl,
        });

        if (wasLive !== nowLive) {
          setPlayerError(null);
          setHasLoaded(false);
        }
      } catch (error) {
        console.error("Failed to check stream status:", error);
        setStreamInfo({ isLive: false });
      } finally {
        setCheckingStream(false);
      }
    };

    checkStream();
    const interval = setInterval(checkStream, 10000);
    return () => clearInterval(interval);
  }, [streamInfo.isLive]);

  // ─── Broadcast HLS.js Setup ───
  useEffect(() => {
    if (!hasBroadcast || !broadcastVideo) return;
    const videoEl = broadcastVideoRef.current;
    if (!videoEl) return;

    const url = broadcastVideo.playbackUrl;
    if (!url || url.trim() === "") return;

    if (broadcastHlsRef.current) {
      broadcastHlsRef.current.destroy();
      broadcastHlsRef.current = null;
    }

    const isHLS = url.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      broadcastHlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          broadcastHlsRef.current = null;
          // Skip to next on error
          handleBroadcastError();
        }
      });
    } else if (isHLS && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    } else {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    }

    return () => {
      if (broadcastHlsRef.current) {
        broadcastHlsRef.current.destroy();
        broadcastHlsRef.current = null;
      }
    };
  }, [hasBroadcast, broadcastVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBroadcastEnded = useCallback(() => {
    if (horizontalVideos) {
      setBroadcastIndex(prev => (prev + 1) % horizontalVideos.length);
    }
  }, [horizontalVideos]);

  const handleBroadcastError = useCallback(() => {
    setTimeout(() => {
      if (horizontalVideos) {
        setBroadcastIndex(prev => (prev + 1) % horizontalVideos.length);
      }
    }, 2000);
  }, [horizontalVideos]);

  const handleBroadcastSkip = useCallback(() => {
    if (horizontalVideos) {
      setBroadcastIndex(prev => (prev + 1) % horizontalVideos.length);
    }
  }, [horizontalVideos]);

  // Determine badge state
  const getBadge = () => {
    if (checkingStream) return null;
    if (streamInfo.isLive) {
      return { color: "bg-[#4CAF50]", label: "Live", pulse: true };
    }
    if (hasBroadcast) {
      return { color: "bg-[#EB83EA]", label: "Dragverse TV", pulse: true };
    }
    return { color: "bg-[#C62828]", label: "Offline", pulse: false };
  };

  const badge = getBadge();

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left - Hero Slider */}
      <div className="lg:col-span-1 min-h-[400px]">
        <HeroSlider />
      </div>

      {/* Right - Dragverse Stream / Broadcast */}
      <div className="lg:col-span-2 relative rounded-[32px] overflow-hidden bg-[#1a0b2e] min-h-[400px] shadow-2xl">
        {/* Status Badge */}
        {badge && (
          <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.color}`}>
            <span className={`w-2 h-2 bg-white rounded-full ${badge.pulse ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase text-white">{badge.label}</span>
          </div>
        )}

        {checkingStream ? (
          // Loading state
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a0b2e]">
            <div className="w-8 h-8 border-2 border-[#EB83EA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : streamInfo.isLive ? (
          // Live stream player
          <div className="relative h-full">
            <Player.Root
              src={getSrc(streamInfo.playbackUrl || `https://livepeercdn.studio/hls/${streamInfo.playbackId}/index.m3u8`)}
              autoPlay
            >
              <Player.Container className="h-full">
                <Player.Video
                  className="w-full h-full object-cover"
                  onLoadedData={() => {
                    setHasLoaded(true);
                    setPlayerError(null);
                  }}
                  onError={(e) => {
                    if (!hasLoaded) {
                      console.error('Video element error:', e);
                      setPlayerError('Unable to load stream. Please try again.');
                    }
                  }}
                />
                <Player.Controls autoHide={3000} className="p-4">
                  <div className="flex items-center gap-2">
                    <Player.PlayPauseTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                    <Player.MuteTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                    <Player.FullscreenTrigger className="ml-auto w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                  </div>
                </Player.Controls>
              </Player.Container>
            </Player.Root>

            {/* Error Display */}
            {playerError && !hasLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-red-500/20 border-2 border-red-500/40 rounded-2xl p-6 max-w-md mx-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-red-300 font-semibold mb-2">Stream Error</p>
                  <p className="text-red-200 text-sm mb-4">{playerError}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setPlayerError(null);
                        setHasLoaded(false);
                      }}
                      className="flex-1 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-200 rounded-lg font-medium text-sm transition"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => {
                        setStreamInfo({ isLive: false });
                        setPlayerError(null);
                      }}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg font-medium text-sm transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : hasBroadcast && broadcastVideo ? (
          // Video Broadcast — auto-playing Dragverse videos
          <div className="absolute inset-0">
            <video
              ref={broadcastVideoRef}
              muted={broadcastMuted}
              autoPlay
              playsInline
              poster={getSafeThumbnail(broadcastVideo.thumbnail, "/currently-offline.jpg", broadcastVideo.livepeerAssetId)}
              className="w-full h-full object-cover"
              onEnded={handleBroadcastEnded}
              onError={handleBroadcastError}
            />
            {/* Broadcast controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-end justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/watch/${broadcastVideo.id}`}
                    className="text-white font-bold text-sm hover:text-[#EB83EA] transition line-clamp-1"
                  >
                    {broadcastVideo.title}
                  </Link>
                  <p className="text-gray-300 text-xs mt-0.5">
                    @{broadcastVideo.creator?.handle}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button
                    onClick={() => setBroadcastMuted(!broadcastMuted)}
                    className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
                    aria-label={broadcastMuted ? "Unmute" : "Mute"}
                  >
                    {broadcastMuted ? (
                      <FiVolumeX className="w-4 h-4 text-white" />
                    ) : (
                      <FiVolume2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <button
                    onClick={handleBroadcastSkip}
                    className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
                    aria-label="Skip to next video"
                  >
                    <FiSkipForward className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
            {/* Up Next indicator */}
            {broadcastNextVideo && (
              <div className="absolute top-4 right-4 z-10 max-w-[180px] px-3 py-2 bg-black/60 backdrop-blur-sm rounded-xl">
                <p className="text-white/50 text-[10px] uppercase tracking-wider">Up Next</p>
                <p className="text-white/80 text-xs font-medium line-clamp-1 mt-0.5">
                  {broadcastNextVideo.title}
                </p>
              </div>
            )}
          </div>
        ) : (
          // Offline placeholder - clean image only
          <div className="absolute inset-0">
            <Image
              src="/currently-offline.jpg"
              alt="Stream Currently Offline"
              fill
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}
