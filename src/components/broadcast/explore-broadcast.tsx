"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import Hls from "hls.js";
import { FiVolume2, FiVolumeX, FiSkipForward } from "react-icons/fi";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface ExploreBroadcastProps {
  videos: Video[];
}

export function ExploreBroadcast({ videos }: ExploreBroadcastProps) {
  // Stream status
  const [streamInfo, setStreamInfo] = useState<{
    isLive: boolean;
    playbackId?: string;
    playbackUrl?: string;
  }>({ isLive: false });
  const [checkingStream, setCheckingStream] = useState(true);

  // Broadcast state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const hasBroadcast = videos.length >= 5;
  const currentVideo = hasBroadcast ? videos[currentIndex] : null;
  const nextVideo = hasBroadcast ? videos[(currentIndex + 1) % videos.length] : null;

  // Poll stream status (same pattern as HeroSection)
  useEffect(() => {
    const checkStream = async () => {
      try {
        const response = await fetch("/api/stream/status/official", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const data = await response.json();
        setStreamInfo({
          isLive: data.isLive || false,
          playbackId: data.playbackId,
          playbackUrl: data.playbackUrl,
        });
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
  }, []);

  // HLS.js broadcast setup
  useEffect(() => {
    if (streamInfo.isLive || !hasBroadcast || !currentVideo) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const url = currentVideo.playbackUrl;
    if (!url || url.trim() === "") return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHLS = url.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          handleError();
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamInfo.isLive, currentVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnded = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % videos.length);
  }, [videos.length]);

  const handleError = useCallback(() => {
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % videos.length);
    }, 2000);
  }, [videos.length]);

  const handleSkip = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % videos.length);
  }, [videos.length]);

  if (checkingStream) return null;

  // Priority 1: Live stream
  if (streamInfo.isLive) {
    return (
      <section className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#4CAF50] rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase text-white">Live Now</span>
          </div>
          <h2 className="font-heading text-2xl font-black uppercase tracking-wide">
            Dragverse Official
          </h2>
        </div>
        <div className="relative aspect-video rounded-[24px] overflow-hidden bg-[#1a0b2e] shadow-2xl border border-white/10">
          <Player.Root
            src={getSrc(streamInfo.playbackUrl || `https://livepeercdn.studio/hls/${streamInfo.playbackId}/index.m3u8`)}
            autoPlay
          >
            <Player.Container className="h-full">
              <Player.Video className="w-full h-full object-cover" />
              <Player.Controls autoHide={3000} className="p-4">
                <div className="flex items-center gap-2">
                  <Player.PlayPauseTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                  <Player.MuteTrigger className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                  <Player.FullscreenTrigger className="ml-auto w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition" />
                </div>
              </Player.Controls>
            </Player.Container>
          </Player.Root>
        </div>
      </section>
    );
  }

  // Priority 2: Video broadcast (5+ videos)
  if (hasBroadcast && currentVideo) {
    return (
      <section className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EB83EA] rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-bold uppercase text-white">Dragverse TV</span>
            </div>
            <h2 className="font-heading text-xl lg:text-2xl font-black uppercase tracking-wide">
              Video Channel
            </h2>
          </div>
          <span className="text-gray-400 text-sm">
            {currentIndex + 1} / {videos.length}
          </span>
        </div>
        <div className="relative aspect-video rounded-[24px] overflow-hidden bg-black border border-[#EB83EA]/20 shadow-2xl">
          <video
            ref={videoRef}
            muted={isMuted}
            autoPlay
            playsInline
            poster={getSafeThumbnail(currentVideo.thumbnail, "/currently-offline.jpg", currentVideo.livepeerAssetId)}
            className="w-full h-full object-cover"
            onEnded={handleEnded}
            onError={handleError}
          />
          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-end justify-between">
              <div className="min-w-0">
                <Link
                  href={`/watch/${currentVideo.id}`}
                  className="text-white font-bold text-sm hover:text-[#EB83EA] transition line-clamp-1"
                >
                  {currentVideo.title}
                </Link>
                <p className="text-gray-300 text-xs mt-0.5">
                  @{currentVideo.creator?.handle}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <FiVolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <FiVolume2 className="w-4 h-4 text-white" />
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
                  aria-label="Skip to next video"
                >
                  <FiSkipForward className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
          {/* Up Next */}
          {nextVideo && (
            <div className="absolute top-4 right-4 z-10 max-w-[180px] px-3 py-2 bg-black/60 backdrop-blur-sm rounded-xl">
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Up Next</p>
              <p className="text-white/80 text-xs font-medium line-clamp-1 mt-0.5">
                {nextVideo.title}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Priority 3: Nothing
  return null;
}
