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
  const [progressPercent, setProgressPercent] = useState(0);
  const [volumePercent, setVolumePercent] = useState(volume * 100);

  // Track progress percent for CSS variable
  useEffect(() => {
    if (duration > 0) {
      setProgressPercent((currentTime / duration) * 100);
    }
  }, [currentTime, duration]);

  // Track volume percent for CSS variable
  useEffect(() => {
    setVolumePercent(volume * 100);
  }, [volume]);

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
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setVolumePercent(newVolume * 100);
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
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10 audio-progress-slider"
          style={{
            '--progress-percent': `${progressPercent}%`
          } as React.CSSProperties}
          aria-label="Audio progress"
        />
        <div
          className="h-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] transition-all pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${progressPercent}%`, transform: "translateX(-50%)" }}
        />
      </div>

      {/* Player Controls */}
      <div className="px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20">
              <Image
                src={currentTrack.thumbnail || "/default-thumbnail.jpg"}
                alt={currentTrack.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold truncate text-xs sm:text-sm">
                {currentTrack.title}
              </h4>
              <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={previous}
              className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Previous"
              aria-label="Previous track"
            >
              <FiSkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:shadow-lg hover:shadow-[#EB83EA]/30 flex items-center justify-center transition-all"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <FiPause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <FiPlay className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Next"
              aria-label="Next track"
            >
              <FiSkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>

          {/* Time Display — visible on all sizes, compact on mobile */}
          <div className="flex items-center gap-1 text-[10px] sm:text-sm text-gray-400 font-mono flex-shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Volume Control — hidden on mobile to save space */}
          <div className="hidden sm:flex items-center gap-2 relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              title="Volume"
              aria-label="Toggle volume control"
              aria-expanded={showVolumeSlider}
            >
              {volume === 0 ? (
                <FiVolumeX className="w-5 h-5 text-white" />
              ) : (
                <FiVolume2 className="w-5 h-5 text-white" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#18122D] rounded-xl border-2 border-[#EB83EA]/20 shadow-lg z-20">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="audio-volume-slider w-24"
                  style={{
                    '--volume-percent': `${volumePercent}%`
                  } as React.CSSProperties}
                  aria-label="Volume level"
                />
                <div className="text-center text-xs text-gray-400 mt-1 font-mono">
                  {Math.round(volume * 100)}%
                </div>
              </div>
            )}
          </div>

          {/* External Link (for YouTube tracks) — desktop only */}
          {currentTrack.type === "youtube" && (
            <button
              onClick={openInYouTube}
              className="hidden sm:flex w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 items-center justify-center transition-colors"
              title="Open in YouTube"
              aria-label="Open in YouTube"
            >
              <FiExternalLink className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Minimize/Close */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="hidden sm:flex w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 items-center justify-center transition-colors"
              title="Minimize"
              aria-label="Minimize player"
            >
              <span className="text-white font-bold text-lg leading-none">_</span>
            </button>

            <button
              onClick={stop}
              className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gray-800/50 hover:bg-red-500/50 flex items-center justify-center transition-colors"
              title="Close"
              aria-label="Close player"
            >
              <FiX className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
