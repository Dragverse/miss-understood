"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiFilm } from "react-icons/fi";
import { getSafeThumbnail, getSafeAvatar } from "@/lib/utils/thumbnail-helpers";

interface UpcomingPremiere {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  contentType: string;
  creatorHandle: string | null;
  creatorName: string;
  creatorAvatar: string | null;
}

function getTimeLeft(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

function Countdown({ publishedAt }: { publishedAt: string }) {
  const [t, setT] = useState(() => getTimeLeft(publishedAt));

  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft(publishedAt)), 1000);
    return () => clearInterval(id);
  }, [publishedAt]);

  if (!t) return <span className="text-[#EB83EA] text-xs font-bold uppercase tracking-wider">Starting soon</span>;

  if (t.days > 0) {
    return (
      <span className="text-white text-xs font-bold tabular-nums">
        {t.days}d {String(t.hours).padStart(2, "0")}h {String(t.minutes).padStart(2, "0")}m
      </span>
    );
  }
  if (t.hours > 0) {
    return (
      <span className="text-[#EB83EA] text-xs font-bold tabular-nums">
        {String(t.hours).padStart(2, "0")}h {String(t.minutes).padStart(2, "0")}m {String(t.seconds).padStart(2, "0")}s
      </span>
    );
  }
  return (
    <span className="text-[#EB83EA] text-xs font-bold tabular-nums animate-pulse">
      {String(t.minutes).padStart(2, "0")}m {String(t.seconds).padStart(2, "0")}s
    </span>
  );
}

export function UpcomingPremieresSection() {
  const [premieres, setPremieres] = useState<UpcomingPremiere[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPremieres = async () => {
      try {
        const res = await fetch("/api/videos/upcoming-premieres");
        if (!res.ok) return;
        const data = await res.json();
        setPremieres(data.premieres ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchPremieres();
    // Re-check every 60s — premieres going live will fall off naturally
    const interval = setInterval(fetchPremieres, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading || premieres.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Header — same structure as LiveNowSection */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center">
            <FiFilm className="text-[#EB83EA] w-5 h-5" />
          </div>
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide whitespace-nowrap font-black">
            Upcoming Premieres
          </h2>
        </div>
        <div className="h-px bg-gradient-to-r from-[#2f2942] to-transparent w-full" />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {premieres.map((premiere) => {
          const href = `/premiere/${premiere.id}`;
          const creatorHref = premiere.creatorHandle ? `/u/${premiere.creatorHandle}` : "#";

          return (
            <Link
              key={premiere.id}
              href={href}
              className="group relative bg-[#1a0b2e] rounded-[20px] border border-[#2f2942] hover:border-[#EB83EA]/40 transition-all overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#EB83EA]/10 via-[#2a0f42] to-[#1a0b2e]">
                {premiere.thumbnail ? (
                  <Image
                    src={getSafeThumbnail(premiere.thumbnail, "/default-thumbnail.jpg")}
                    alt={premiere.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FiFilm className="w-8 h-8 text-white/10" />
                  </div>
                )}

                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* PREMIERE badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-[#EB83EA] rounded-md text-xs font-bold text-white shadow-lg">
                  <FiFilm className="w-3 h-3" />
                  PREMIERE
                </div>

                {/* Countdown in bottom-right */}
                <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/80 rounded-md flex items-center gap-1.5">
                  <Countdown publishedAt={premiere.publishedAt} />
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-white mb-3 line-clamp-2 group-hover:text-[#EB83EA] transition-colors text-sm leading-snug">
                  {premiere.title}
                </h3>
                <Link
                  href={creatorHref}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                >
                  <Image
                    src={getSafeAvatar(premiere.creatorAvatar ?? "", "/defaultpfp.png")}
                    alt={premiere.creatorName}
                    width={28}
                    height={28}
                    className="rounded-full object-cover ring-1 ring-white/10"
                  />
                  <p className="text-sm text-gray-300 font-medium truncate">{premiere.creatorName}</p>
                </Link>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
