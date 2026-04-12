"use client";

import { useEffect, useState } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiVideo, FiClock } from "react-icons/fi";

interface LivestreamEmbedProps {
  creatorDID: string;
  creatorName: string;
}

// Mirrors the shape hero-section uses for its streamInfo
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

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          `/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        const prevLive = streamInfo.isLive;

        if (data.streams?.length > 0) {
          const s = data.streams[0];
          setStreamInfo({
            isLive: true,
            playbackId: s.playbackId,
            playbackUrl: s.playbackUrl,
            title: s.name || `${creatorName} is live!`,
          });
          // Reset player error when stream changes
          if (!prevLive) setPlayerError(false);
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

  if (checking) return null;

  // ── Active stream ────────────────────────────────────────────────────────
  if (streamInfo.isLive && streamInfo.playbackId) {
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

        {/* Player — identical structure to hero-section */}
        <div className="relative h-full" style={{ minHeight: 320 }}>
          {playerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
              <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
              <button
                onClick={() => setPlayerError(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition"
              >
                Retry
              </button>
            </div>
          ) : (
            <Player.Root
              src={getSrc(
                streamInfo.playbackUrl ||
                `https://livepeercdn.studio/hls/${streamInfo.playbackId}/index.m3u8`
              )}
              autoPlay
            >
              <Player.Container className="h-full" style={{ minHeight: 320 }}>
                <Player.Video
                  className="w-full h-full object-cover"
                  onLoadedData={() => setPlayerError(false)}
                  onError={() => setPlayerError(true)}
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
