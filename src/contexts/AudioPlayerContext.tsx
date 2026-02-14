"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  audioUrl: string;
  duration?: number;
  type: "youtube" | "uploaded";
  youtubeId?: string;
}

interface AudioPlayerContextType {
  // Current track
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  // Playlist
  playlist: AudioTrack[];
  currentIndex: number;

  // Actions
  playTrack: (track: AudioTrack, playlist?: AudioTrack[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  togglePlayPause: () => void;

  // Audio element ref (for external control)
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [playlist, setPlaylist] = useState<AudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  // Update audio element volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      // Auto-play next track if available
      if (currentIndex < playlist.length - 1) {
        next();
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentIndex, playlist.length]);

  const playTrack = useCallback((track: AudioTrack, newPlaylist?: AudioTrack[]) => {
    const audio = audioRef.current;
    console.log("[AudioPlayerContext] 🎵 playTrack called:", {
      trackId: track.id,
      trackTitle: track.title,
      audioUrl: track.audioUrl,
      hasAudioElement: !!audio,
    });

    if (!audio) {
      console.error("[AudioPlayerContext] ❌ No audio element found!");
      return;
    }

    // Update playlist if provided
    if (newPlaylist) {
      setPlaylist(newPlaylist);
      const index = newPlaylist.findIndex(t => t.id === track.id);
      setCurrentIndex(index >= 0 ? index : 0);
    } else {
      // Single track playback
      setPlaylist([track]);
      setCurrentIndex(0);
    }

    setCurrentTrack(track);

    // For YouTube tracks, we'll need to use YouTube embedded player
    // For now, if it's a YouTube track without direct audio URL, skip
    if (track.type === "youtube" && !track.audioUrl) {
      console.warn("[AudioPlayer] YouTube tracks require external playback");
      return;
    }

    console.log("[AudioPlayerContext] Setting audio.src to:", track.audioUrl);
    audio.src = track.audioUrl;
    audio.load();
    console.log("[AudioPlayerContext] Calling audio.play()...");
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(err => {
        console.error("[AudioPlayer] Playback failed:", err);

        // Show user-friendly error message
        if (err.name === "NotAllowedError" || err.name === "NotSupportedError") {
          toast.error(
            "Playback blocked. Please tap the play button to start.",
            {
              duration: 5000,
              id: 'audio-autoplay-blocked', // Prevent duplicate toasts
            }
          );
        } else {
          toast.error("Failed to play audio. Please try again.");
        }

        // Keep track loaded but not playing
        setIsPlaying(false);
      });
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("[AudioPlayer] Resume failed:", err);

          if (err.name === "NotAllowedError") {
            toast.error("Please tap play to resume playback.");
          } else {
            toast.error("Failed to resume audio.");
          }

          setIsPlaying(false);
        });
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTrack(null);
      setPlaylist([]);
    }
  }, []);

  const next = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      const nextTrack = playlist[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      playTrack(nextTrack);
    }
  }, [currentIndex, playlist, playTrack]);

  const previous = useCallback(() => {
    if (currentIndex > 0) {
      const prevTrack = playlist[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      playTrack(prevTrack);
    } else {
      // Restart current track
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
      }
    }
  }, [currentIndex, playlist, playTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clampedVolume = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVolume);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playlist,
        currentIndex,
        playTrack,
        pause,
        resume,
        stop,
        next,
        previous,
        seek,
        setVolume,
        togglePlayPause,
        audioRef,
      }}
    >
      {children}
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: "none" }} />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}
