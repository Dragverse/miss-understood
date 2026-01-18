"use client";

import { useState, useRef, useEffect } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import type { Video } from "@/types";

interface ShortVideoProps {
  video: Video;
  isActive: boolean;
  onNext?: () => void;
}

export function ShortVideo({ video, isActive, onNext }: ShortVideoProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<HTMLVideoElement>(null);

  // Listen for play/pause events from the video element
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (onNext) {
        onNext();
      }
    };

    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, [onNext]);

  // Control play/pause based on isActive prop
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isActive) {
      player.play().catch(() => {
        // Autoplay may be blocked by browser
      });
    } else {
      player.pause();
    }
  }, [isActive]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVideoClick = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="keen-slider__slide flex snap-center justify-center focus-visible:outline-none md:ml-16 md:pb-2">
      <div className="rounded-large ultrawide:w-[650px] bg-gray-950 flex h-full w-[calc(100vw-80px)] items-center overflow-hidden md:w-[450px] relative">
        {video.playbackUrl ? (
          <div className="w-full h-full relative" onClick={handleVideoClick}>
            <Player.Root
              src={getSrc(video.playbackUrl)}
              aspectRatio={9 / 16}
              volume={isMuted ? 0 : 1}
              onError={(error) => {
                console.error("Video playback error:", error);
                console.log("Video URL:", video.playbackUrl);
                console.log("Video data:", {
                  id: video.id,
                  title: video.title,
                  source: video.source,
                  externalUrl: video.externalUrl,
                });
              }}
            >
              <Player.Container className="h-full w-full">
                <Player.Video
                  ref={playerRef}
                  className="h-full w-full object-contain"
                  loop
                  playsInline
                  muted={isMuted}
                />
              </Player.Container>
            </Player.Root>

            {/* Mute/Unmute Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="absolute top-4 right-4 p-3 bg-black/50 rounded-full hover:bg-black/70 transition z-10"
            >
              {isMuted ? (
                <FiVolumeX className="w-5 h-5 text-white" />
              ) : (
                <FiVolume2 className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Play/Pause Indicator */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-400">Video not available</p>
          </div>
        )}
      </div>
    </div>
  );
}
