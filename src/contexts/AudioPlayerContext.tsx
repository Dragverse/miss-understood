"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import Hls from "hls.js";

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
  const hlsRef = useRef<Hls | null>(null);
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

      // Clean up HLS instance on unmount
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
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

    // Destroy existing HLS instance if any
    if (hlsRef.current) {
      console.log("[AudioPlayerContext] Destroying previous HLS instance");
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const audioUrl = track.audioUrl;
    const isHLS = audioUrl.includes('.m3u8');

    console.log("[AudioPlayerContext] Loading audio:", {
      url: audioUrl,
      isHLS,
      hlsSupported: Hls.isSupported(),
      nativeHLS: audio.canPlayType('application/vnd.apple.mpegurl')
    });

    // If HLS stream and browser doesn't support HLS natively, use HLS.js
    if (isHLS && Hls.isSupported()) {
      console.log("[AudioPlayerContext] Using HLS.js for playback");
      const hls = new Hls({
        debug: false,
        enableWorker: true,
      });
      hlsRef.current = hls;

      hls.loadSource(audioUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[AudioPlayerContext] HLS manifest parsed, attempting playback");
        audio.play()
          .then(() => {
            console.log("[AudioPlayerContext] ✅ HLS playback started");
            setIsPlaying(true);
          })
          .catch(err => {
            console.error("[AudioPlayer] HLS playback failed:", err);
            handlePlaybackError(err);
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("[AudioPlayer] HLS error:", data.type, data.details);
        if (data.fatal) {
          // Audio files on Livepeer don't have HLS manifests — fall back to direct download URL
          if (data.details === 'manifestParsingError' || data.details === 'manifestLoadError') {
            console.warn("[AudioPlayer] HLS manifest unavailable, falling back to direct URL");
            hls.destroy();
            hlsRef.current = null;

            const hlsMatch = audioUrl.match(/\/hls\/([^/]+)\//);
            if (hlsMatch) {
              const playbackId = hlsMatch[1];
              const directUrl = `https://livepeercdn.com/asset/${playbackId}/video`;
              console.log("[AudioPlayer] Trying direct URL:", directUrl);
              audio.src = directUrl;
              audio.load();
              audio.play()
                .then(() => {
                  console.log("[AudioPlayer] ✅ Direct playback started");
                  setIsPlaying(true);
                })
                .catch(err => {
                  console.error("[AudioPlayer] Direct playback also failed:", err);
                  handlePlaybackError(err);
                });
            } else {
              toast.error("Failed to load audio stream");
            }
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("[AudioPlayer] Fatal network error, trying to recover");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("[AudioPlayer] Fatal media error, trying to recover");
              hls.recoverMediaError();
              break;
            default:
              console.error("[AudioPlayer] Fatal error, cannot recover");
              hls.destroy();
              toast.error("Failed to load audio stream");
              break;
          }
        }
      });
    } else if (isHLS && audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari can play HLS natively
      console.log("[AudioPlayerContext] Using native HLS playback (Safari)");
      audio.src = audioUrl;
      audio.load();
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("[AudioPlayer] Native HLS playback failed:", err);
          handlePlaybackError(err);
        });
    } else {
      // Regular audio file (MP3, MP4, etc.)
      console.log("[AudioPlayerContext] Using standard audio playback");
      audio.src = audioUrl;
      audio.load();
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("[AudioPlayer] Standard playback failed:", err);
          handlePlaybackError(err);
        });
    }

    function handlePlaybackError(err: Error) {
      // AbortError is harmless — just means a new load() interrupted a pending play()
      if (err.name === "AbortError") {
        console.log("[AudioPlayer] Play interrupted by new load (harmless)");
        return;
      }
      if (err.name === "NotAllowedError" || err.name === "NotSupportedError") {
        toast.error(
          "Playback blocked. Please tap the play button to start.",
          {
            duration: 5000,
            id: 'audio-autoplay-blocked',
          }
        );
      } else {
        toast.error("Failed to play audio. Please try again.");
      }
      setIsPlaying(false);
    }
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

    // Clean up HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
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
