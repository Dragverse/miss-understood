"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const checkCreatorStream = async () => {
      try {
        const response = await fetch(`/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`);

        if (!response.ok) {
          setStreamData(null);
          setUpcomingStream(null);
          return;
        }

        const data = await response.json();

        // Check for active streams
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
        }

        // Check for upcoming scheduled streams
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
    const interval = setInterval(checkCreatorStream, 30000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]);

  if (loading) return null;

  // Active stream takes priority
  if (streamData?.isActive) {
    return (
      <div className="w-full mb-8 bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2f2942] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              <span className="text-white text-sm font-bold uppercase">LIVE</span>
            </div>
            <h2 className="text-xl font-bold text-white">{streamData.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiVideo className="w-5 h-5" />
            <span className="text-sm">{creatorName} is streaming</span>
          </div>
        </div>

        <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://lvpr.tv/?v=${encodeURIComponent(streamData.playbackId)}&lowLatency=force&autoplay=true&webrtc=false`}
            className="absolute top-0 left-0 w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            title={`${creatorName} live stream`}
          />
        </div>
      </div>
    );
  }

  // Show upcoming stream if no active stream
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
