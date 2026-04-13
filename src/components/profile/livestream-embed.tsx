"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { FiVideo, FiClock, FiVolume2, FiVolumeX, FiMaximize2 } from "react-icons/fi";
import { useStreamStore } from "@/lib/store/stream";

interface LivestreamEmbedProps {
  creatorDID: string;
  creatorName: string;
}

interface StreamInfo {
  isLive: boolean;
  playbackId?: string;
  playbackUrl?: string;
  title?: string;
}

interface UpcomingStream {
  title: string;
  scheduledAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function LivestreamEmbed({ creatorDID, creatorName }: LivestreamEmbedProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({ isLive: false });
  const [upcoming, setUpcoming] = useState<UpcomingStream | null>(null);
  const [checking, setChecking] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeStream = useStreamStore((s) => s.activeStream);
  const isOwnActiveStream = activeStream?.creatorDID === creatorDID;

  // ── Poll stream status ───────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          `/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.streams?.length > 0) {
          const s = data.streams[0];
          setStreamInfo((prev) => {
            // Reset error flag when a new stream starts
            if (!prev.isLive) setPlayerError(false);
            return {
              isLive: true,
              playbackId: s.playbackId,
              playbackUrl: s.playbackUrl,
              title: s.name || `${creatorName} is live!`,
            };
          });
        } else {
          setStreamInfo({ isLive: false });
        }

        setUpcoming(
          data.upcoming?.length > 0
            ? { title: data.upcoming[0].name || "Upcoming Stream", scheduledAt: data.upcoming[0].scheduledAt }
            : null
        );
      } catch {
        // silent — keep last known state
      } finally {
        setChecking(false);
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HLS.js player setup ──────────────────────────────────────────────────
  // Runs whenever the stream goes live or the playback URL changes.
  // Same approach used by hero-section and ShortVideo throughout the codebase.
  const effectivePlaybackId = streamInfo.playbackId ?? (isOwnActiveStream ? activeStream?.playbackId : undefined);
  const playbackUrl = streamInfo.playbackUrl ||
    (effectivePlaybackId ? `https://livepeercdn.studio/hls/${effectivePlaybackId}/index.m3u8` : null);

  useEffect(() => {
    if (!streamInfo.isLive || !playbackUrl) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Tear down any previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setPlayerError(false);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {
          // Autoplay blocked — video stays paused, user can tap play
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setPlayerError(true);
        }
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari / iOS)
      videoEl.src = playbackUrl;
      videoEl.play().catch(() => {});
    } else {
      setPlayerError(true);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamInfo.isLive, playbackUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep video muted state in sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // ── Render guards ────────────────────────────────────────────────────────

  // While initial check is running, show Connecting only to the streamer
  if (checking && !isOwnActiveStream) return null;

  // Streamer just went live — "Connecting" while DB/API catches up
  if (isOwnActiveStream && !streamInfo.isLive) {
    return (
      <div className="w-full mb-8 bg-black/60 border border-red-500/30 rounded-[24px] overflow-hidden p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 font-bold uppercase tracking-widest text-sm">Connecting…</span>
        </div>
        <p className="text-gray-400 text-sm">Your stream is starting. It will appear here in a moment.</p>
      </div>
    );
  }

  if (checking) return null;

  // ── Active stream ────────────────────────────────────────────────────────
  if (streamInfo.isLive && playbackUrl) {
    const handleRetry = () => {
      setPlayerError(false);
      // Re-trigger the HLS setup by toggling isLive won't work easily;
      // instead, directly re-init if videoEl is available
      const videoEl = videoRef.current;
      if (!videoEl || !playbackUrl) return;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: -1 });
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { videoEl.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setPlayerError(true); });
      }
    };

    const handleFullscreen = () => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen?.();
      }
    };

    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2f2942] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-bold uppercase tracking-wide">LIVE</span>
            </div>
            <h2 className="text-xl font-bold text-white">{streamInfo.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiVideo className="w-5 h-5" />
            <span className="text-sm">{creatorName} is streaming</span>
          </div>
        </div>

        {/* Player */}
        <div ref={containerRef} className="relative w-full aspect-video bg-black group">
          {playerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
              <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              {/* Controls overlay — visible on hover */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted
                    ? <FiVolumeX className="w-4 h-4 text-white" />
                    : <FiVolume2 className="w-4 h-4 text-white" />
                  }
                </button>
                <button
                  onClick={handleFullscreen}
                  className="ml-auto w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition"
                  aria-label="Fullscreen"
                >
                  <FiMaximize2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Upcoming ─────────────────────────────────────────────────────────────
  if (upcoming) {
    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#EB83EA]/20 rounded-[24px] overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#EB83EA]/20 border border-[#EB83EA]/30 rounded-full">
              <FiClock className="w-3 h-3 text-[#EB83EA]" />
              <span className="text-[#EB83EA] text-sm font-bold uppercase">Upcoming</span>
            </div>
            <h2 className="text-lg font-bold text-white">{upcoming.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiVideo className="w-5 h-5" />
            <span className="text-sm">Going live {formatDate(upcoming.scheduledAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
