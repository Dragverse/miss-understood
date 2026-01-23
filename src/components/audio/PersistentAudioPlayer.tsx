"use client";

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import Image from "next/image";
import { useState, useEffect } from "react";
import {
  FiPlay,
  FiPause,
  FiSkipBack,
  FiSkipForward,
  FiVolume2,
  FiVolumeX,
  FiX,
  FiExternalLink
} from "react-icons/fi";

export function PersistentAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayPause,
    next,
    previous,
    seek,
    setVolume,
    stop,
  } = useAudioPlayer();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Don't render if no track
  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // For YouTube tracks, provide link to open in YouTube
  const openInYouTube = () => {
    if (currentTrack.type === "youtube" && currentTrack.youtubeId) {
      window.open(`https://www.youtube.com/watch?v=${currentTrack.youtubeId}`, "_blank");
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] shadow-lg shadow-[#EB83EA]/30 flex items-center justify-center hover:shadow-[#EB83EA]/50 transition-all"
        >
          {isPlaying ? (
            <FiPause className="w-6 h-6 text-white" />
          ) : (
            <FiPlay className="w-6 h-6 text-white ml-0.5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] border-t-2 border-[#EB83EA]/20 backdrop-blur-xl">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-800 cursor-pointer group relative">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          className="h-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
        />
      </div>

      {/* Player Controls */}
      <div className="px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20">
              <Image
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold truncate text-sm">
                {currentTrack.title}
              </h4>
              <p className="text-gray-400 text-xs truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={previous}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Previous"
            >
              <FiSkipBack className="w-5 h-5 text-white" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:shadow-lg hover:shadow-[#EB83EA]/30 flex items-center justify-center transition-all"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <FiPause className="w-6 h-6 text-white" />
              ) : (
                <FiPlay className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Next"
            >
              <FiSkipForward className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Time Display */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Volume Control */}
          <div className="hidden md:flex items-center gap-2 relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Volume"
            >
              {volume === 0 ? (
                <FiVolumeX className="w-5 h-5 text-white" />
              ) : (
                <FiVolume2 className="w-5 h-5 text-white" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#18122D] rounded-xl border-2 border-[#EB83EA]/20 shadow-lg">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#EB83EA]"
                />
              </div>
            )}
          </div>

          {/* External Link (for YouTube tracks) */}
          {currentTrack.type === "youtube" && (
            <button
              onClick={openInYouTube}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Open in YouTube"
            >
              <FiExternalLink className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Minimize/Close */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Minimize"
            >
              <span className="text-white font-bold">_</span>
            </button>

            <button
              onClick={stop}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-red-500/50 flex items-center justify-center transition-colors"
              title="Close"
            >
              <FiX className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
