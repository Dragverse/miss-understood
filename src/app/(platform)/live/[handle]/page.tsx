"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Hls from "hls.js";
import {
  FiArrowLeft,
  FiVolume2,
  FiVolumeX,
  FiMaximize2,
  FiUsers,
} from "react-icons/fi";

interface Creator {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  verified: boolean;
  bio: string;
  followerCount: number;
  followingCount: number;
}

interface StreamInfo {
  id: string;
  title: string;
  playbackId: string;
  playbackUrl: string;
  startedAt: string | null;
  peakViewers: number;
  totalViews: number;
}

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return "";
  const diff = Date.now() - new Date(startedAt).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LivePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const handle = params.handle as string;

  // ?p= lets us bypass DB lookup entirely — guaranteed fallback when DB insert fails
  const directPlaybackId = searchParams.get("p");

  const [creator, setCreator] = useState<Creator | null>(null);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [elapsed, setElapsed] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine the effective playback URL
  const playbackUrl = stream?.playbackUrl
    ?? (directPlaybackId
      ? `https://livepeercdn.studio/hls/${directPlaybackId}/index.m3u8`
      : null);

  const isLive = !!playbackUrl;

  // Fetch creator + stream info from the API (skipped when ?p is present and stream already loaded)
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/stream/live?handle=${encodeURIComponent(handle)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.creator) setCreator(data.creator);
        if (data.stream) setStream(data.stream);
      } catch {
        // silent — direct ?p= link still works without creator info
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();

    // Poll every 15s to pick up new streams and clean up ended ones
    pollingRef.current = setInterval(fetchInfo, 15_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [handle]);

  // If we have a direct playbackId but API hasn't returned yet, unblock loading
  useEffect(() => {
    if (directPlaybackId) setLoading(false);
  }, [directPlaybackId]);

  // Elapsed timer
  useEffect(() => {
    if (!stream?.startedAt) return;
    const id = setInterval(() => setElapsed(formatDuration(stream.startedAt)), 1_000);
    return () => clearInterval(id);
  }, [stream?.startedAt]);

  // HLS player — same pattern as livestream-embed.tsx
  useEffect(() => {
    if (!isLive || !playbackUrl) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setPlayerError(false);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setPlayerError(true);
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
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
  }, [isLive, playbackUrl]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const handleRetry = () => {
    setPlayerError(false);
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f071a]">
      {/* Back nav */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <Link
          href={creator ? `/u/${creator.handle}` : "/"}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
        >
          <FiArrowLeft className="w-4 h-4" />
          {creator ? `Back to ${creator.displayName}'s profile` : "Back"}
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12 space-y-6">
        {/* Creator header */}
        {creator && (
          <div className="flex items-center gap-4">
            <Link href={`/u/${creator.handle}`}>
              <Image
                src={creator.avatar}
                alt={creator.displayName}
                width={56}
                height={56}
                className="rounded-full object-cover ring-2 ring-[#EB83EA]/40"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/u/${creator.handle}`}
                  className="font-bold text-white text-lg hover:text-[#EB83EA] transition"
                >
                  {creator.displayName}
                </Link>
                {isLive && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold uppercase tracking-wider">LIVE</span>
                  </div>
                )}
              </div>
              {stream?.title && (
                <p className="text-gray-300 text-sm mt-0.5 truncate">{stream.title}</p>
              )}
            </div>
            {elapsed && (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                <FiUsers className="w-4 h-4" />
                <span>{elapsed}</span>
              </div>
            )}
          </div>
        )}

        {/* Player */}
        {isLive ? (
          <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden group"
          >
            {playerError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
                <button
                  onClick={handleRetry}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition"
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
                {/* Controls overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                  <button
                    onClick={() => setIsMuted((m) => !m)}
                    className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted
                      ? <FiVolumeX className="w-4 h-4 text-white" />
                      : <FiVolume2 className="w-4 h-4 text-white" />}
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
        ) : (
          /* Not live state */
          <div className="w-full aspect-video bg-[#1a0b2e] border border-[#2f2942] rounded-[20px] flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <FiUsers className="w-7 h-7 text-gray-500" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">
                {creator ? `${creator.displayName} is not live right now` : "Stream not found"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {creator
                  ? "Check back later or follow to get notified."
                  : "This stream may have ended or the link has expired."}
              </p>
            </div>
            {creator && (
              <Link
                href={`/u/${creator.handle}`}
                className="px-5 py-2 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 text-[#EB83EA] rounded-full text-sm font-semibold transition"
              >
                Visit Profile
              </Link>
            )}
          </div>
        )}

        {/* Stats row — only show when live */}
        {isLive && stream && (stream.peakViewers > 0 || stream.totalViews > 0) && (
          <div className="flex items-center gap-6 text-sm text-gray-400">
            {stream.peakViewers > 0 && (
              <span>{stream.peakViewers.toLocaleString()} peak viewers</span>
            )}
            {stream.totalViews > 0 && (
              <span>{stream.totalViews.toLocaleString()} total views</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
