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
  creatorDid?: string;
  contentType?: string;
}

interface AudioPlayerContextType {
  // Current track
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackError: string | null;

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
  updatePlaylist: (playlist: AudioTrack[]) => void;

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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const isFetchingMore = useRef(false);
  const playedIds = useRef<Set<string>>(new Set());

  // Use refs for values needed in event handlers to avoid stale closures
  const playlistRef = useRef(playlist);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Internal: load and play a track's audio without changing playlist/index
  const loadAudio = useCallback((track: AudioTrack, audioEl: HTMLAudioElement) => {
    setCurrentTrack(track);
    setPlaybackError(null);
    playedIds.current.add(track.id);

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const audioUrl = track.audioUrl;
    const isHLS = audioUrl.includes('.m3u8');

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ debug: false, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(audioUrl);
      hls.attachMedia(audioEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        audioEl.play()
          .then(() => setIsPlaying(true))
          .catch(err => handlePlaybackError(err));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.details === 'manifestParsingError' || data.details === 'manifestLoadError') {
            hls.destroy();
            hlsRef.current = null;
            const hlsMatch = audioUrl.match(/\/hls\/([^/]+)\//);
            if (hlsMatch) {
              const playbackId = hlsMatch[1];
              const directUrl = `https://livepeercdn.studio/asset/${playbackId}/original`;
              audioEl.src = directUrl;
              audioEl.load();
              audioEl.play()
                .then(() => setIsPlaying(true))
                .catch(err => handlePlaybackError(err));
            } else {
              toast.error("Failed to load audio stream");
            }
            return;
          }
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              toast.error("Failed to load audio stream");
              break;
          }
        }
      });
    } else if (isHLS && audioEl.canPlayType('application/vnd.apple.mpegurl')) {
      audioEl.src = audioUrl;
      audioEl.load();
      audioEl.play()
        .then(() => setIsPlaying(true))
        .catch(err => handlePlaybackError(err));
    } else {
      audioEl.src = audioUrl;
      audioEl.load();
      audioEl.play()
        .then(() => setIsPlaying(true))
        .catch(err => handlePlaybackError(err));
    }

    function handlePlaybackError(err: Error) {
      if (err.name === "AbortError") return;
      if (err.name === "NotSupportedError") {
        const errorMsg = "Audio file unavailable. It may need to be re-uploaded.";
        setPlaybackError(errorMsg);
        toast.error(errorMsg, { duration: 6000, id: 'audio-unavailable' });
      } else if (err.name === "NotAllowedError") {
        toast.error("Playback blocked. Please tap the play button to start.", { duration: 5000, id: 'audio-autoplay-blocked' });
      } else {
        toast.error("Failed to play audio. Please try again.");
      }
      setIsPlaying(false);
    }
  }, []);

  // Fetch more tracks when playlist is exhausted (continuous play)
  const fetchAndPlayMore = useCallback(async (afterTrack: AudioTrack, afterIndex: number) => {
    if (isFetchingMore.current) return false;
    isFetchingMore.current = true;

    try {
      const contentType = afterTrack.contentType || "music";
      const creatorDid = afterTrack.creatorDid;
      const excludeIds = Array.from(playedIds.current);

      // Try related endpoint first (same artist priority), fall back to list
      const tryFetch = async (url: string): Promise<AudioTrack[]> => {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        const videos = data.videos || [];

        return videos
          .filter((v: any) => {
            const hasUrl = v.playback_url || v.playbackUrl;
            return hasUrl && !excludeIds.includes(v.id);
          })
          .map((v: any) => ({
            id: v.id,
            title: v.title,
            artist: v.creator?.display_name || v.creator?.displayName || "Unknown Artist",
            thumbnail: v.thumbnail || "/default-thumbnail.jpg",
            audioUrl: v.playback_url || v.playbackUrl,
            duration: v.duration,
            type: "uploaded" as const,
            creatorDid: v.creator_did || v.creatorDid || creatorDid,
            contentType: v.content_type || v.contentType || contentType,
          }));
      };

      let newTracks: AudioTrack[] = [];

      // Pass 1: Related (same artist priority)
      if (creatorDid) {
        newTracks = await tryFetch(
          `/api/video/related?videoId=${afterTrack.id}&contentType=${contentType}&creatorDid=${creatorDid}&limit=20`
        );
      }

      // Pass 2: General list fallback
      if (newTracks.length === 0) {
        newTracks = await tryFetch(`/api/videos/list?contentType=${contentType}&limit=20`);
      }

      if (newTracks.length > 0) {
        const nextTrack = newTracks[0];
        const newIndex = afterIndex + 1;

        // Append to playlist and start playing the next track
        setPlaylist(prev => [...prev, ...newTracks]);
        setCurrentIndex(newIndex);

        const audio = audioRef.current;
        if (audio) {
          loadAudio(nextTrack, audio);
        }

        isFetchingMore.current = false;
        return true;
      }
    } catch (error) {
      console.error("[AudioPlayer] Failed to fetch more tracks:", error);
    }

    isFetchingMore.current = false;
    return false;
  }, [loadAudio]);

  // Update audio element volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle time updates and track ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      const idx = currentIndexRef.current;
      const pl = playlistRef.current;

      if (idx < pl.length - 1) {
        // More tracks in playlist — advance
        const nextTrack = pl[idx + 1];
        setCurrentIndex(idx + 1);
        currentIndexRef.current = idx + 1;
        loadAudio(nextTrack, audio);
      } else {
        // Playlist exhausted — fetch more for continuous play
        const endedTrack = pl[idx];
        if (endedTrack) {
          fetchAndPlayMore(endedTrack, idx).then((gotMore) => {
            if (!gotMore) {
              setIsPlaying(false);
            }
          });
        } else {
          setIsPlaying(false);
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [loadAudio, fetchAndPlayMore]);

  const playTrack = useCallback((track: AudioTrack, newPlaylist?: AudioTrack[]) => {
    const audio = audioRef.current;
    if (!audio) {
      console.error("[AudioPlayerContext] No audio element found!");
      return;
    }

    // Update playlist
    if (newPlaylist) {
      setPlaylist(newPlaylist);
      playlistRef.current = newPlaylist;
      const index = newPlaylist.findIndex(t => t.id === track.id);
      const newIdx = index >= 0 ? index : 0;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
    } else {
      setPlaylist([track]);
      playlistRef.current = [track];
      setCurrentIndex(0);
      currentIndexRef.current = 0;
    }

    if (track.type === "youtube" && !track.audioUrl) {
      console.warn("[AudioPlayer] YouTube tracks require external playback");
      return;
    }

    loadAudio(track, audio);
  }, [loadAudio]);

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
      playlistRef.current = [];
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    playedIds.current.clear();
    isFetchingMore.current = false;
  }, []);

  const next = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentIndex < playlist.length - 1) {
      const nextTrack = playlist[currentIndex + 1];
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
      loadAudio(nextTrack, audio);
    }
  }, [currentIndex, playlist, loadAudio]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentIndex > 0) {
      const prevTrack = playlist[currentIndex - 1];
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
      loadAudio(prevTrack, audio);
    } else {
      audio.currentTime = 0;
    }
  }, [currentIndex, playlist, loadAudio]);

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

  // Update playlist without restarting current playback (for extending queue)
  const updatePlaylist = useCallback((newPlaylist: AudioTrack[]) => {
    setPlaylist(newPlaylist);
    playlistRef.current = newPlaylist;
    if (currentTrack) {
      const idx = newPlaylist.findIndex(t => t.id === currentTrack.id);
      if (idx >= 0) {
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
      }
    }
  }, [currentTrack]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playbackError,
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
        updatePlaylist,
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
