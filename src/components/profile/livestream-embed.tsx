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
  title: string;
  playbackUrl: string;
  playbackId: string;
  isActive: boolean;
}

interface UpcomingStreamData {
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
  const [playerError, setPlayerError] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          `/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`
        );
        if (!res.ok) {
          setStreamData(null);
          setUpcomingStream(null);
          return;
        }
        const data = await res.json();

        if (data.streams && data.streams.length > 0) {
          const s = data.streams[0];
          setStreamData({
            title: s.name || `${creatorName} is live!`,
            playbackUrl: s.playbackUrl,
            playbackId: s.playbackId,
            isActive: s.isActive,
          });
          setPlayerError(false);
        } else {
          setStreamData(null);
        }

        if (data.upcoming && data.upcoming.length > 0) {
          const n = data.upcoming[0];
          setUpcomingStream({ title: n.name || "Upcoming Stream", scheduledAt: n.scheduledAt });
        } else {
          setUpcomingStream(null);
        }
      } catch {
        setStreamData(null);
        setUpcomingStream(null);
      } finally {
        setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]);

  if (loading) return null;

  if (streamData?.isActive) {
    // HLS URL — same approach as hero section, works reliably for live HLS
    const hlsUrl =
      streamData.playbackUrl ||
      `https://livepeercdn.studio/hls/${streamData.playbackId}/index.m3u8`;
    const src = getSrc(hlsUrl);

    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] overflow-hidden">
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

        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <div className="absolute inset-0 bg-black">
            {playerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
                <button
                  onClick={() => setPlayerError(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition"
                >
                  Retry
                </button>
              </div>
            ) : (
              <Player.Root src={src} autoPlay>
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
            <span className="text-sm">Going live {formatScheduledDate(upcomingStream.scheduledAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
