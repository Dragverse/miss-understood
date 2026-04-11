"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiShare2, FiClock } from "react-icons/fi";
import { getVideo, type SupabaseVideo } from "@/lib/supabase/videos";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";
import { LoadingShimmer } from "@/components/shared";
import type { Video } from "@/types";
import toast from "react-hot-toast";

function getTimeRemaining(targetDate: Date) {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export default function PremierePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  // Fetch video data
  useEffect(() => {
    async function loadVideo() {
      try {
        const videoDoc = await getVideo(resolvedParams.id);
        if (!videoDoc) {
          setIsLoading(false);
          return;
        }

        const formatted = await transformVideoWithCreator(videoDoc);

        // If already published or not a countdown premiere, redirect to watch
        if (!formatted.publishedAt || new Date(formatted.publishedAt) <= new Date()) {
          window.location.href = `/watch/${resolvedParams.id}`;
          return;
        }

        if (formatted.premiereMode !== "countdown") {
          window.location.href = `/watch/${resolvedParams.id}`;
          return;
        }

        setVideo(formatted);
        setCountdown(getTimeRemaining(new Date(formatted.publishedAt)));
      } catch (error) {
        console.error("[Premiere] Failed to load video:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadVideo();
  }, [resolvedParams.id]);

  // Update countdown every second
  useEffect(() => {
    if (!video?.publishedAt) return;

    const targetDate = new Date(video.publishedAt);
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(targetDate);
      setCountdown(remaining);

      if (remaining.expired) {
        clearInterval(interval);
        // Redirect to watch page when countdown expires
        window.location.href = `/watch/${resolvedParams.id}`;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [video?.publishedAt, resolvedParams.id]);

  const handleShare = async () => {
    const url = `${window.location.origin}/premiere/${resolvedParams.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Premiere link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <LoadingShimmer aspectRatio="video" className="mb-6" />
          <LoadingShimmer lines={3} />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Premiere not found</p>
          <Link href="/" className="text-[#EB83EA] hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Blurred thumbnail background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
          alt=""
          fill
          className="object-cover blur-3xl opacity-20 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f071a]/80 via-[#0f071a]/60 to-[#0f071a]" />
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        {/* Creator Info */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#EB83EA]/40">
            <Image
              src={video.creator.avatar || "/defaultpfp.png"}
              alt={video.creator.displayName}
              fill
              className="object-cover"
            />
          </div>
          <div className="text-left">
            <p className="font-bold text-white">{video.creator.displayName}</p>
            <p className="text-sm text-gray-400">@{video.creator.handle}</p>
          </div>
        </div>

        {/* Video Thumbnail */}
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#EB83EA]/30 shadow-2xl shadow-[#EB83EA]/10">
          <Image
            src={getSafeThumbnail(video.thumbnail, video.livepeerAssetId)}
            alt={video.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-[#EB83EA]/30 backdrop-blur-sm flex items-center justify-center border border-[#EB83EA]/50">
              <FiClock className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#EB83EA] mb-2">
            Premiering Soon
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-white">
            {video.title}
          </h1>
        </div>

        {/* Countdown Timer */}
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          {countdown.days > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.days)}</span>
              </div>
              <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Days</span>
            </div>
          )}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.hours)}</span>
            </div>
            <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Hours</span>
          </div>
          <div className="text-2xl font-bold text-[#EB83EA] self-start mt-6">:</div>
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.minutes)}</span>
            </div>
            <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Minutes</span>
          </div>
          <div className="text-2xl font-bold text-[#EB83EA] self-start mt-6">:</div>
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border border-[#EB83EA]/30 flex items-center justify-center animate-pulse">
              <span className="text-3xl sm:text-4xl font-bold text-white">{pad(countdown.seconds)}</span>
            </div>
            <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Seconds</span>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-8 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition-all hover:scale-105 transform"
        >
          <FiShare2 className="w-5 h-5" />
          Share Premiere
        </button>

        {/* Scheduled date */}
        {video.publishedAt && (
          <p className="text-sm text-gray-400">
            Drops {new Date(video.publishedAt).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
