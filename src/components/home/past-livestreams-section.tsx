"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiVideo } from "react-icons/fi";
import { getSafeAvatar, getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

interface LivestreamRecording {
  id: string;
  title: string;
  thumbnail?: string;
  playback_id?: string;
  created_at: string;
  creator?: {
    handle: string;
    display_name: string;
    avatar?: string;
  } | null;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PastLivestreamsSection() {
  const [recordings, setRecordings] = useState<LivestreamRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        // Fetch all public videos and filter for live recordings client-side.
        // The list endpoint already supports contentType as a query param.
        const res = await fetch("/api/videos/list?contentType=live&limit=8");
        if (!res.ok) return;
        const data = await res.json();

        const videos: LivestreamRecording[] = (data.videos ?? []).filter(
          (v: any) => v.content_type === "live"
        );

        setRecordings(videos.slice(0, 8));
      } catch {
        // silent — don't surface fetch errors to users
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, []);

  if (loading || recordings.length === 0) return null;

  return (
    <section className="space-y-6">
      {/* Section header — matches site style */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <FiVideo className="text-[#EB83EA] w-5 h-5" />
          </div>
          <h2 className="font-heading text-2xl lg:text-3xl uppercase tracking-wide whitespace-nowrap font-black">
            Past Livestreams
          </h2>
        </div>
        <div className="h-px bg-gradient-to-r from-[#2f2942] to-transparent w-full" />
      </div>

      {/* Recording cards — two columns on desktop, single on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recordings.map((recording) => {
          const creatorName = recording.creator?.display_name ?? "Unknown creator";
          const creatorAvatar = recording.creator?.avatar ?? null;
          const thumbnailSrc = getSafeThumbnail(
            recording.thumbnail,
            "/default-thumbnail.jpg",
            recording.playback_id
          );
          const avatarSrc = getSafeAvatar(creatorAvatar, "/defaultpfp.png");

          return (
            <Link
              key={recording.id}
              href={`/watch/${recording.id}`}
              className="group flex flex-col sm:flex-row gap-0 rounded-[16px] border border-[#2f2942] bg-[#1a0b2e] hover:border-[#EB83EA]/30 transition-all overflow-hidden"
            >
              {/* Thumbnail — left on desktop, top on mobile */}
              <div className="relative w-full sm:w-[42%] aspect-video sm:aspect-auto sm:min-h-[120px] flex-shrink-0 overflow-hidden bg-gradient-to-br from-purple-900/30 via-[#2a0f42] to-[#1a0b2e]">
                <Image
                  src={thumbnailSrc}
                  alt={recording.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/default-thumbnail.jpg";
                  }}
                />

                {/* REPLAY badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 bg-red-600 rounded-md text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  Replay
                </div>

                {/* Subtle play overlay on hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-0 h-0 border-t-6 border-t-transparent border-l-8 border-l-white border-b-6 border-b-transparent ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info — right on desktop, below on mobile */}
              <div className="flex flex-col justify-between gap-2 p-4 flex-1 min-w-0">
                <h3 className="font-bold text-white text-sm leading-snug line-clamp-2 group-hover:text-[#EB83EA] transition-colors">
                  {recording.title}
                </h3>

                <div className="flex items-center gap-2 mt-auto">
                  <Image
                    src={avatarSrc}
                    alt={creatorName}
                    width={24}
                    height={24}
                    className="rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/defaultpfp.png";
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-gray-300 font-medium truncate">
                      {creatorName}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {formatRelativeDate(recording.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
