"use client";

import { useEffect, useState } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiVideo, FiClock } from "react-icons/fi";

interface LivestreamEmbedProps {
  creatorDID: string;
  creatorName: string;
}

interface StreamData {
  streamId: string;
  title: string;
  playbackUrl: string;
  playbackId: string;
  isActive: boolean;
}

interface UpcomingStreamData {
  id: string;
  title: string;
  scheduledAt: string;
}

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LivestreamEmbed({ creatorDID, creatorName }: LivestreamEmbedProps) {
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [upcomingStream, setUpcomingStream] = useState<UpcomingStreamData | null>(null);
  const [loading, setLoading] = useState(true);
  // Full Livepeer playback info — enables WebRTC WHEP for low-latency
  const [playbackSrc, setPlaybackSrc] = useState<ReturnType<typeof getSrc>>(null);
  const [playerError, setPlayerError] = useState(false);

  useEffect(() => {
    const checkCreatorStream = async () => {
      try {
        const response = await fetch(
          `/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`
        );

        if (!response.ok) {
          setStreamData(null);
          setUpcomingStream(null);
          return;
        }

        const data = await response.json();

        if (data.streams && data.streams.length > 0) {
          const activeStream = data.streams[0];
          setStreamData({
            streamId: activeStream.id,
            title: activeStream.name || `${creatorName} is live!`,
            playbackUrl: activeStream.playbackUrl,
            playbackId: activeStream.playbackId,
            isActive: activeStream.isActive,
          });
        } else {
          setStreamData(null);
          setPlaybackSrc(null);
        }

        if (data.upcoming && data.upcoming.length > 0) {
          const next = data.upcoming[0];
          setUpcomingStream({
            id: next.id,
            title: next.name || "Upcoming Stream",
            scheduledAt: next.scheduledAt,
          });
        } else {
          setUpcomingStream(null);
        }
      } catch (error) {
        console.error("Failed to check creator stream:", error);
        setStreamData(null);
        setUpcomingStream(null);
      } finally {
        setLoading(false);
      }
    };

    checkCreatorStream();
    // Poll every 10s — fast enough to catch go-live events promptly
    const interval = setInterval(checkCreatorStream, 10_000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]);

  // When a live stream is detected, fetch full Livepeer playback info for WebRTC WHEP
  useEffect(() => {
    if (!streamData?.isActive || !streamData.playbackId) return;

    const fetchPlaybackInfo = async () => {
      try {
        const res = await fetch(
          `/api/stream/playback-info?playbackId=${encodeURIComponent(streamData.playbackId)}`
        );
        if (res.ok) {
          const info = await res.json();
          const src = getSrc(info);
          if (src && src.length > 0) {
            setPlaybackSrc(src);
            return;
          }
        }
      } catch {
        // fall through to HLS fallback
      }
      // Fallback: HLS URL directly
      setPlaybackSrc(
        getSrc(
          streamData.playbackUrl ||
            `https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`
        )
      );
    };

    fetchPlaybackInfo();
    setPlayerError(false);
  }, [streamData?.isActive, streamData?.playbackId, streamData?.playbackUrl]);

  if (loading) return null;

  // Active stream — Livepeer Player SDK (same as hero section)
  if (streamData?.isActive && playbackSrc) {
    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2f2942] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-bold uppercase tracking-wide">LIVE</span>
            </div>
            <h2 className="text-xl font-bold text-white">{streamData.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiVideo className="w-5 h-5" />
            <span className="text-sm">{creatorName} is streaming</span>
          </div>
        </div>

        {/* Player */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <div className="absolute inset-0">
            {playerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-3">
                <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
                <button
                  onClick={() => {
                    setPlayerError(false);
                    setPlaybackSrc(
                      getSrc(
                        streamData.playbackUrl ||
                          `https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`
                      )
                    );
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition"
                >
                  Retry
                </button>
              </div>
            ) : (
              <Player.Root src={playbackSrc} autoPlay lowLatency="force">
                <Player.Container className="w-full h-full">
                  <Player.Video
                    className="w-full h-full object-cover"
                    onError={() => setPlayerError(true)}
                  />
                  <Player.LoadingIndicator className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="w-8 h-8 border-2 border-[#EB83EA] border-t-transparent rounded-full animate-spin" />
                  </Player.LoadingIndicator>
                  <Player.Controls autoHide={3000} className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="flex items-center gap-2">
                      <Player.PlayPauseTrigger className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" />
                      <Player.MuteTrigger className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" />
                      <Player.FullscreenTrigger className="ml-auto w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" />
                    </div>
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Upcoming stream
  if (upcomingStream) {
    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#EB83EA]/20 rounded-[24px] overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#EB83EA]/20 border border-[#EB83EA]/30 rounded-full">
              <FiClock className="w-3 h-3 text-[#EB83EA]" />
              <span className="text-[#EB83EA] text-sm font-bold uppercase">Upcoming</span>
            </div>
            <h2 className="text-lg font-bold text-white">{upcomingStream.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiVideo className="w-5 h-5" />
            <span className="text-sm">
              Going live {formatScheduledDate(upcomingStream.scheduledAt)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
