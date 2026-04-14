"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiVolume2, FiVolumeX, FiMaximize2 } from "react-icons/fi";
import type { Video } from "@/types";
import { getSafeThumbnail } from "@/lib/utils/thumbnail-helpers";

// Safety-only fallback — videos advance via onEnded; this just guards against stalled playback
const MAX_SLIDE_DURATION = 5 * 60 * 1000;

interface ExploreTVSliderProps {
  videos: Video[];
  /** kept for API compatibility — now uses onended + fallback timer */
  autoPlayInterval?: number;
}

export function ExploreTVSlider({ videos }: ExploreTVSliderProps) {
  const filtered = videos.filter(
    (v) => v.contentType !== "short" && v.contentType !== "live"
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mutedRef = useRef(true); // tracks current muted state for use inside async closures

  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const total = filtered.length;
  const current = filtered[idx];

  const goTo = useCallback(
    (next: number) => {
      setIdx(((next % total) + total) % total);
      setIsLoading(true);
    },
    [total]
  );

  // Load and play video whenever idx changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    let cancelled = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Clear previous content immediately
    video.pause();
    video.src = "";
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const src =
      current.playbackUrl ||
      (current.livepeerAssetId
        ? `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${current.livepeerAssetId}/index.m3u8`
        : "");

    if (!src) return;

    video.muted = mutedRef.current; // preserve user's mute preference across videos

    const load = async () => {
      const isHLS = src.includes(".m3u8");

      if (isHLS && !video.canPlayType("application/vnd.apple.mpegurl")) {
        // HLS.js path (Chrome, Firefox)
        const Hls = (await import("hls.js")).default;
        if (cancelled) return;
        if (!Hls.isSupported()) {
          video.src = src;
          video.play().catch(() => {});
          return;
        }
        const hls = new Hls({ startLevel: 1, maxBufferLength: 20 });
        if (cancelled) {
          hls.destroy();
          return;
        }
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal && !cancelled) goTo(idx + 1);
        });
      } else {
        // Native HLS (Safari) or direct URL
        video.src = src;
        video.load();
        video.play().catch(() => {});
      }
    };

    load();

    // Fallback: advance after MAX_SLIDE_DURATION even if video never ends
    timerRef.current = setTimeout(() => goTo(idx + 1), MAX_SLIDE_DURATION);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Sync muted state without reloading the source
  useEffect(() => {
    mutedRef.current = muted;
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleEnded = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    goTo(idx + 1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  if (total === 0) return null;

  const poster = current
    ? getSafeThumbnail(current.thumbnail, "/default-thumbnail.jpg", current.livepeerAssetId)
    : "/default-thumbnail.jpg";

  return (
    <div className="w-full mb-8">
      {/* Player container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-black group"
        style={{ aspectRatio: "16/9" }}
      >
        {/* Thumbnail — visible while video is buffering */}
        <Image
          src={poster}
          alt={current?.title || ""}
          fill
          priority
          className={`object-cover transition-opacity duration-500 pointer-events-none ${
            isLoading ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Video */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          muted
          playsInline
          autoPlay
          onCanPlay={() => setIsLoading(false)}
          onEnded={handleEnded}
        />

        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

        {/* Video info — bottom left, links to watch page */}
        <Link
          href={`/watch/${current?.id}`}
          className="absolute bottom-3 left-4"
          style={{ right: "112px" }}
        >
          <p className="text-white font-semibold text-sm md:text-base line-clamp-1 drop-shadow-lg">
            {current?.title}
          </p>
          <p className="text-gray-300 text-xs drop-shadow">
            @{current?.creator?.handle || current?.creator?.displayName}
          </p>
        </Link>

        {/* Controls — bottom right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA]/80 transition-colors"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <FiVolumeX className="w-4 h-4 text-white" />
            ) : (
              <FiVolume2 className="w-4 h-4 text-white" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-[#EB83EA]/80 transition-colors"
            aria-label="Fullscreen"
          >
            <FiMaximize2 className="w-4 h-4 text-white" />
          </button>
        </div>

      </div>

      {/* Indicators */}
      {total > 1 && (
        <div className="flex gap-1.5 mt-2.5 justify-center items-center">
          {total <= 12 ? (
            filtered.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  idx === i ? "w-5 h-1.5 bg-[#EB83EA]" : "w-1.5 h-1.5 bg-white/30"
                }`}
              />
            ))
          ) : (
            <span className="text-xs text-gray-400">
              {idx + 1} / {total}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
