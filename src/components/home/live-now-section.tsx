"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiRadio } from "react-icons/fi";
import { getSafeAvatar } from "@/lib/utils/thumbnail-helpers";

interface LiveStream {
  id: string;
  title: string;
  playbackId: string;
  creatorDID: string;
  creatorHandle: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  peakViewers: number;
}

export function LiveNowSection() {
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const res = await fetch("/api/stream/active");
        if (!res.ok) return;
        const data = await res.json();
        setLiveStreams(data.streams ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 30_000);
    return () => clearInterval(interval);
  }, []);

  const displayStreams = liveStreams.filter((s) => s.creatorHandle);
  if (loading || displayStreams.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header — matches site section style */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center">
            <FiRadio className="text-red-400 w-5 h-5" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
          </div>
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide whitespace-nowrap font-black">
            Happening Now
          </h2>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-red-500 rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-xs font-bold uppercase tracking-wide">Live</span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-[#2f2942] to-transparent w-full" />
      </div>

      {/* Stream cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {displayStreams.map((stream) => {
          const href = `/u/${stream.creatorHandle}`;

          return (
            <Link
              key={stream.id}
              href={href}
              className="group relative bg-[#1a0b2e] rounded-[20px] border border-[#2f2942] hover:border-red-500/40 transition-all overflow-hidden"
            >
              {/* Thumbnail area — gradient with live indicator */}
              <div className="relative aspect-video bg-gradient-to-br from-red-900/30 via-[#2a0f42] to-[#1a0b2e] flex items-center justify-center overflow-hidden">
                {/* Subtle animated background */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_50%,rgba(235,131,234,0.15),transparent_60%)]" />
                <FiRadio className="w-8 h-8 text-white/15" />

                {/* LIVE badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-md text-xs font-bold text-white shadow-lg">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>

                {/* Viewer count */}
                {stream.peakViewers > 0 && (
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 rounded-md text-xs font-bold text-white">
                    {stream.peakViewers.toLocaleString()} watching
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-white mb-3 line-clamp-2 group-hover:text-[#EB83EA] transition-colors text-sm leading-snug">
                  {stream.title}
                </h3>
                <div className="flex items-center gap-2.5">
                  <Image
                    src={getSafeAvatar(stream.creatorAvatar ?? "", "/defaultpfp.png")}
                    alt={stream.creatorName}
                    width={28}
                    height={28}
                    className="rounded-full object-cover ring-1 ring-white/10"
                  />
                  <p className="text-sm text-gray-300 font-medium truncate">{stream.creatorName}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
