"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Hls from "hls.js";
import { FiChevronLeft, FiChevronRight, FiFilm, FiHeart } from "react-icons/fi";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface LiveStream {
  id: string;
  title: string;
  playbackId: string;
  creatorDID: string;
  creatorHandle: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  startedAt?: string;
}

interface SnapshotsSectionProps {
  shorts: Video[];
}

export function SnapshotsSection({ shorts }: SnapshotsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -300 : 300,
        behavior: "smooth",
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  // Fetch live streams on mount (non-blocking, fire-and-forget)
  useEffect(() => {
    fetch("/api/stream/active")
      .then((r) => (r.ok ? r.json() : { streams: [] }))
      .then((data) => setLiveStreams(data.streams || []))
      .catch(() => {});
  }, []);

  // HLS.js setup for the broadcast card
  useEffect(() => {
    if (shorts.length === 0) return;
    const videoEl = broadcastRef.current;
    if (!videoEl) return;
    const url = shorts[0].playbackUrl;
    if (!url || url.trim() === "") return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isHLS = url.includes(".m3u8");
    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { videoEl.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) { hls.destroy(); hlsRef.current = null; }
      });
    } else if (isHLS && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    } else {
      videoEl.src = url;
      videoEl.play().catch(() => {});
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [shorts]);

  if (shorts.length === 0 && liveStreams.length === 0) return null;

  const latestShort = shorts[0];
  const broadcastPoster = latestShort
    ? getSafeThumbnail(latestShort.thumbnail, "/default-thumbnail.jpg", (latestShort as any).playbackId)
    : "/default-thumbnail.jpg";

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiFilm className="text-[#EB83EA] w-7 h-7" />
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide">
            <span className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent font-black">
              Snapshots
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#EB83EA] hover:border-[#EB83EA] transition-all hover:text-white"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* ── Live Creator Cards — pinned first ── */}
        {liveStreams.map((stream) => (
          <Link
            key={stream.id}
            href={stream.creatorHandle ? `/u/${stream.creatorHandle}` : "#"}
            className="flex-shrink-0 snap-start"
          >
            <div className="relative w-[140px] sm:w-[160px] md:w-[180px] aspect-[9/16] rounded-[24px] overflow-hidden group cursor-pointer shadow-xl hover:shadow-2xl transition-shadow bg-[#0f071a] border-2 border-red-500/60 hover:border-red-400 transition-colors">
              {/* Avatar as background */}
              {stream.creatorAvatar ? (
                <Image
                  src={stream.creatorAvatar}
                  alt={stream.creatorName}
                  fill
                  className="object-cover scale-110 blur-sm group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] to-[#EB83EA]" />
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

              {/* Pulsing live ring */}
              <div className="absolute inset-0 rounded-[22px] ring-2 ring-red-500/60 animate-pulse pointer-events-none" />

              {/* ONLINE badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500 rounded-full shadow-lg shadow-red-500/40">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-[10px] font-bold uppercase tracking-wide">Live</span>
              </div>

              {/* Creator avatar circle — center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-red-500 ring-offset-2 ring-offset-black/50 shadow-lg shadow-red-500/30">
                  {stream.creatorAvatar ? (
                    <Image
                      src={stream.creatorAvatar}
                      alt={stream.creatorName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
                      <span className="text-white font-bold text-xl">
                        {stream.creatorName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate">
                  {stream.creatorName}
                </p>
                <p className="text-white text-sm font-bold truncate">{stream.title}</p>
                <p className="text-gray-300 text-xs mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  Watch Now
                </p>
              </div>
            </div>
          </Link>
        ))}

        {/* ── Snapshots TV Broadcast Card ── */}
        {shorts.length > 0 && (
          <Link href="/snapshots" className="flex-shrink-0 snap-start">
            <div className="relative w-[140px] sm:w-[160px] md:w-[180px] aspect-[9/16] rounded-[24px] overflow-hidden group cursor-pointer shadow-xl hover:shadow-2xl transition-shadow bg-black border-2 border-[#EB83EA]/40">
              {/* Snapshots badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-full shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full" />
                <span className="text-white text-[10px] font-bold uppercase tracking-wide">On Air</span>
              </div>
              {/* Auto-playing muted video */}
              <video
                ref={broadcastRef}
                muted
                autoPlay
                playsInline
                loop
                poster={broadcastPoster}
                className="h-full w-full object-cover"
              />
              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent">
                <p className="text-[#EB83EA] text-[10px] font-bold uppercase tracking-widest mb-1">Snapshots TV</p>
                <p className="text-white text-sm font-bold">Watch Now</p>
              </div>
            </div>
          </Link>
        )}

        {/* ── Regular snapshot cards ── */}
        {shorts.map((video) => (
          <Link
            key={video.id}
            href={`/snapshots?v=${video.id}`}
            className="flex-shrink-0 snap-start"
          >
            <div className="relative w-[140px] sm:w-[160px] md:w-[180px] aspect-[9/16] rounded-[24px] overflow-hidden group cursor-pointer shadow-xl hover:shadow-2xl transition-shadow bg-black border border-white/5">
              <Image
                src={getSafeThumbnail(video.thumbnail, "/default-thumbnail.jpg", (video as any).playbackId)}
                alt={video.title}
                fill
                className="object-contain group-hover:scale-105 transition-transform duration-500"
                onError={(e) => { (e.target as HTMLImageElement).src = "/default-thumbnail.jpg"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
              {/* Likes */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                <FiHeart className="w-3.5 h-3.5 text-[#EB83EA] fill-[#EB83EA]" />
                <span className="text-white text-xs font-bold">{formatNumber(video.likes)}</span>
              </div>
              {/* Title + creator */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-sm font-bold line-clamp-2 leading-tight">{video.title}</p>
                <p className="text-gray-400 text-xs mt-1 truncate">{video.creator.displayName}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
