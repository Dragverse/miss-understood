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
  creatorBanner: string | null;
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
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center">
            <FiRadio className="text-red-400 w-5 h-5" />
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayStreams.map((stream) => {
          const href = `/u/${stream.creatorHandle}`;
          const avatar = getSafeAvatar(stream.creatorAvatar ?? "", "/defaultpfp.png");

          return (
            <Link
              key={stream.id}
              href={href}
              className="group relative rounded-2xl overflow-hidden border-2 border-transparent hover:border-red-500/60 transition-all duration-300 bg-[#18122D]"
            >
              {/* Card thumbnail — banner bg or gradient, creator avatar centered */}
              <div className="relative aspect-[3/4] overflow-hidden">

                {/* Background — blurred banner or gradient */}
                {stream.creatorBanner ? (
                  <Image
                    src={stream.creatorBanner}
                    alt=""
                    fill
                    className="object-cover scale-110 blur-sm opacity-40 group-hover:opacity-50 transition-opacity"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 via-[#2a0f42] to-[#1a0b2e]" />
                )}

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                {/* Creator avatar — centered with pulsing live ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Outer pulse ring */}
                    <span className="absolute inset-0 rounded-full animate-ping bg-red-500/40 scale-110" />
                    {/* Red ring */}
                    <div className="absolute -inset-1 rounded-full bg-red-500 opacity-80" />
                    {/* Avatar */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
                      <Image
                        src={avatar}
                        alt={stream.creatorName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </div>
                </div>

                {/* LIVE badge — top left */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-md text-[10px] font-bold text-white shadow-lg z-10">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>

                {/* Viewer count — top right */}
                {stream.peakViewers > 0 && (
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-md text-[10px] font-bold text-white z-10">
                    {stream.peakViewers.toLocaleString()} 👁
                  </div>
                )}

                {/* Bottom info overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-3 py-3 z-10">
                  <p className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-lg">
                    {stream.title}
                  </p>
                  <p className="text-red-300 text-xs font-medium mt-1 truncate">
                    @{stream.creatorHandle}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
