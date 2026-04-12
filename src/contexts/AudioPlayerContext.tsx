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
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackError: string | null;
  playlist: AudioTrack[];
  currentIndex: number;
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
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// How many seconds before track end to start the crossfade
const CROSSFADE_SECS = 3;
// Start pre-loading the next track this many seconds before end
const PRELOAD_AHEAD_SECS = 8;

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // Two audio slots: A = active, B = next (swap roles on each transition)
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const hlsARef = useRef<Hls | null>(null);
  const hlsBRef = useRef<Hls | null>(null);
  // Which slot is currently the primary playing track
  const activeSlot = useRef<"a" | "b">("a");

  // Convenience accessors
  const getActive = useCallback((): HTMLAudioElement | null =>
    activeSlot.current === "a" ? audioARef.current : audioBRef.current, []);
  const getInactive = useCallback((): HTMLAudioElement | null =>
    activeSlot.current === "a" ? audioBRef.current : audioARef.current, []);
  const getActiveHls = () => activeSlot.current === "a" ? hlsARef.current : hlsBRef.current;
  const setActiveHls = (hls: Hls | null) => { if (activeSlot.current === "a") hlsARef.current = hls; else hlsBRef.current = hls; };
  const destroyInactiveHls = () => {
    const ref = activeSlot.current === "a" ? hlsBRef : hlsARef;
    if (ref.current) { ref.current.destroy(); ref.current = null; }
  };
  const setInactiveHls = (hls: Hls | null) => { if (activeSlot.current === "a") hlsBRef.current = hls; else hlsARef.current = hls; };

  // Public audioRef always points to the active slot (for compatibility)
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  const playlistRef = useRef(playlist);
  const currentIndexRef = useRef(currentIndex);
  const volumeRef = useRef(1);

  // Crossfade state
  const preloadedNextTrack = useRef<AudioTrack | null>(null);
  const isCrossfading = useRef(false);
  const crossfadeRaf = useRef<number | null>(null);
  const preloadStarted = useRef(false);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // ----- Media Session -----
  const updateMediaSession = useCallback((track: AudioTrack) => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: "Dragverse",
      artwork: [
        { src: track.thumbnail || "/logo.png", sizes: "512x512", type: "image/jpeg" },
        { src: track.thumbnail || "/logo.png", sizes: "256x256", type: "image/jpeg" },
      ],
    });
    navigator.mediaSession.playbackState = "playing";
  }, []);

  // ----- Attach HLS or direct src to an audio element -----
  const attachAudio = useCallback((
    audioEl: HTMLAudioElement,
    track: AudioTrack,
    startVol: number,
    autoPlay: boolean,
    onReady?: () => void,
  ) => {
    audioEl.volume = startVol;
    const url = track.audioUrl;
    const isHLS = url.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ debug: false, enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(audioEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onReady?.();
        if (autoPlay) {
          audioEl.play().catch(() => {});
        }
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          // Fallback: try direct URL
          const hlsMatch = url.match(/\/hls\/([^/]+)\//);
          if (hlsMatch) {
            audioEl.src = `https://livepeercdn.studio/asset/${hlsMatch[1]}/original`;
            audioEl.load();
            if (autoPlay) audioEl.play().catch(() => {});
          }
        }
      });
      return hls;
    } else {
      audioEl.src = url;
      audioEl.load();
      onReady?.();
      if (autoPlay) audioEl.play().catch(() => {});
      return null;
    }
  }, []);

  // ----- Perform the crossfade -----
  const performCrossfade = useCallback((
    outEl: HTMLAudioElement,
    inEl: HTMLAudioElement,
    onComplete: () => void,
  ) => {
    if (crossfadeRaf.current) cancelAnimationFrame(crossfadeRaf.current);

    const startTime = performance.now();
    const durationMs = CROSSFADE_SECS * 1000;
    const masterVol = volumeRef.current;

    // Make sure the incoming element is playing before we start fading
    inEl.play().catch(() => {});

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      // Smooth ease curve
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      outEl.volume = Math.max(0, masterVol * (1 - eased));
      inEl.volume = Math.min(masterVol, masterVol * eased);

      if (t < 1) {
        crossfadeRaf.current = requestAnimationFrame(tick);
      } else {
        outEl.pause();
        outEl.volume = masterVol;
        crossfadeRaf.current = null;
        onComplete();
      }
    }

    crossfadeRaf.current = requestAnimationFrame(tick);
  }, []);

  // ----- Load and play a track (with optional crossfade from current) -----
  const loadAudio = useCallback((track: AudioTrack, forceHardCut = false) => {
    const activeEl = getActive();
    const inactiveEl = getInactive();
    if (!activeEl || !inactiveEl) return;

    setCurrentTrack(track);
    setPlaybackError(null);
    playedIds.current.add(track.id);
    isCrossfading.current = false;
    preloadStarted.current = false;
    preloadedNextTrack.current = null;

    if (crossfadeRaf.current) {
      cancelAnimationFrame(crossfadeRaf.current);
      crossfadeRaf.current = null;
    }

    updateMediaSession(track);

    const currentlyPlaying = !activeEl.paused && activeEl.currentTime > 0;
    const shouldCrossfade = currentlyPlaying && !forceHardCut;

    if (shouldCrossfade) {
      // Load on inactive slot and crossfade
      destroyInactiveHls();
      const newHls = attachAudio(inactiveEl, track, 0, false, () => {
        isCrossfading.current = true;
        performCrossfade(activeEl, inactiveEl, () => {
          // Swap slots
          activeSlot.current = activeSlot.current === "a" ? "b" : "a";
          // Destroy old active HLS
          const oldHls = getActiveHls();
          if (oldHls) { oldHls.destroy(); }
          setActiveHls(newHls);
          isCrossfading.current = false;
          setIsPlaying(true);
        });
      });
      setInactiveHls(newHls);
    } else {
      // Hard cut: stop current, play on active slot
      activeEl.pause();
      const oldHls = getActiveHls();
      if (oldHls) { oldHls.destroy(); }
      destroyInactiveHls();
      inactiveEl.pause();
      inactiveEl.src = "";

      const newHls = attachAudio(activeEl, track, volumeRef.current, true);
      setActiveHls(newHls);
      setIsPlaying(true);
    }
  }, [getActive, getInactive, attachAudio, performCrossfade, updateMediaSession, getActiveHls, setActiveHls, destroyInactiveHls, setInactiveHls]);

  // ----- Preload next track on inactive slot -----
  const preloadNext = useCallback((nextTrack: AudioTrack) => {
    if (preloadStarted.current) return;
    preloadStarted.current = true;
    preloadedNextTrack.current = nextTrack;

    const inactiveEl = getInactive();
    if (!inactiveEl) return;
    destroyInactiveHls();
    inactiveEl.volume = 0;

    const url = nextTrack.audioUrl;
    const isHLS = url.includes(".m3u8");

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ debug: false, enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(inactiveEl);
      setInactiveHls(hls);
    } else {
      inactiveEl.src = url;
      inactiveEl.preload = "auto";
      inactiveEl.load();
      setInactiveHls(null);
    }
  }, [getInactive, destroyInactiveHls, setInactiveHls]);

  // ----- Fetch more tracks when playlist is exhausted -----
  const fetchAndPlayMore = useCallback(async (afterTrack: AudioTrack, afterIndex: number) => {
    if (isFetchingMore.current) return false;
    isFetchingMore.current = true;

    try {
      const contentType = afterTrack.contentType || "music";
      const creatorDid = afterTrack.creatorDid;
      const excludeIds = Array.from(playedIds.current);

      const tryFetch = async (url: string): Promise<AudioTrack[]> => {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.videos || [])
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
      if (creatorDid) {
        newTracks = await tryFetch(
          `/api/video/related?videoId=${afterTrack.id}&contentType=${contentType}&creatorDid=${creatorDid}&limit=20`
        );
      }
      if (newTracks.length === 0) {
        newTracks = await tryFetch(`/api/videos/list?contentType=${contentType}&limit=20`);
      }

      if (newTracks.length > 0) {
        const nextTrack = newTracks[0];
        const newIndex = afterIndex + 1;
        setPlaylist(prev => [...prev, ...newTracks]);
        setCurrentIndex(newIndex);
        loadAudio(nextTrack);
        isFetchingMore.current = false;
        return true;
      }
    } catch (error) {
      console.error("[AudioPlayer] Failed to fetch more tracks:", error);
    }

    isFetchingMore.current = false;
    return false;
  }, [loadAudio]);

  // ----- Sync volume to active audio element -----
  useEffect(() => {
    const active = getActive();
    if (active && !isCrossfading.current) {
      active.volume = volume;
    }
    volumeRef.current = volume;
  }, [volume, getActive]);

  // ----- Register Media Session action handlers -----
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => {
      getActive()?.play().then(() => setIsPlaying(true)).catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      getActive()?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const idx = currentIndexRef.current;
      const pl = playlistRef.current;
      if (idx < pl.length - 1) {
        const nextTrack = pl[idx + 1];
        setCurrentIndex(idx + 1);
        currentIndexRef.current = idx + 1;
        loadAudio(nextTrack);
      }
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const idx = currentIndexRef.current;
      const pl = playlistRef.current;
      if (idx > 0) {
        const prevTrack = pl[idx - 1];
        setCurrentIndex(idx - 1);
        currentIndexRef.current = idx - 1;
        loadAudio(prevTrack, true); // hard cut for prev
      } else {
        const active = getActive();
        if (active) active.currentTime = 0;
      }
    });
    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    };
  }, [loadAudio, getActive]);

  // ----- Time update, ended, and preload logic -----
  useEffect(() => {
    const audioA = audioARef.current;
    const audioB = audioBRef.current;
    if (!audioA || !audioB) return;

    const handleTimeUpdate = () => {
      const active = getActive();
      if (!active || isCrossfading.current) return;
      setCurrentTime(active.currentTime);

      if (!isFinite(active.duration) || active.duration <= 0) return;
      const remaining = active.duration - active.currentTime;

      const idx = currentIndexRef.current;
      const pl = playlistRef.current;
      const nextTrack = idx < pl.length - 1 ? pl[idx + 1] : null;

      // Preload next track early
      if (remaining <= PRELOAD_AHEAD_SECS && nextTrack && !preloadStarted.current) {
        preloadNext(nextTrack);
      }

      // Start crossfade
      if (remaining <= CROSSFADE_SECS && remaining > 0 && nextTrack && !isCrossfading.current && preloadedNextTrack.current?.id === nextTrack.id) {
        isCrossfading.current = true;
        const inactiveEl = getInactive();
        if (!inactiveEl) return;

        const newIdx = idx + 1;
        setCurrentIndex(newIdx);
        currentIndexRef.current = newIdx;
        setCurrentTrack(nextTrack);
        updateMediaSession(nextTrack);

        performCrossfade(active, inactiveEl, () => {
          activeSlot.current = activeSlot.current === "a" ? "b" : "a";
          isCrossfading.current = false;
          preloadStarted.current = false;
          preloadedNextTrack.current = null;
          // Keep the old HLS ref — it gets cleaned up on next loadAudio call
        });
      }
    };

    const handleDurationChange = () => {
      const active = getActive();
      if (active && isFinite(active.duration)) setDuration(active.duration);
    };

    const handleEnded = () => {
      if (isCrossfading.current) return; // crossfade already handled the transition
      const idx = currentIndexRef.current;
      const pl = playlistRef.current;

      if (idx < pl.length - 1) {
        const nextTrack = pl[idx + 1];
        setCurrentIndex(idx + 1);
        currentIndexRef.current = idx + 1;
        loadAudio(nextTrack, true); // hard cut fallback if crossfade didn't happen
      } else {
        const endedTrack = pl[idx];
        if (endedTrack) {
          fetchAndPlayMore(endedTrack, idx).then((gotMore) => {
            if (!gotMore) setIsPlaying(false);
          });
        } else {
          setIsPlaying(false);
        }
      }
    };

    const handlePlayingA = () => { if (activeSlot.current === "a") setIsPlaying(true); };
    const handlePlayingB = () => { if (activeSlot.current === "b") setIsPlaying(true); };
    const handlePauseA = () => { if (activeSlot.current === "a" && !isCrossfading.current) setIsPlaying(false); };
    const handlePauseB = () => { if (activeSlot.current === "b" && !isCrossfading.current) setIsPlaying(false); };

    // Attach listeners to both elements; ended only on active (we swap on crossfade)
    audioA.addEventListener("timeupdate", handleTimeUpdate);
    audioB.addEventListener("timeupdate", handleTimeUpdate);
    audioA.addEventListener("durationchange", handleDurationChange);
    audioB.addEventListener("durationchange", handleDurationChange);
    audioA.addEventListener("ended", handleEnded);
    audioB.addEventListener("ended", handleEnded);
    audioA.addEventListener("playing", handlePlayingA);
    audioB.addEventListener("playing", handlePlayingB);
    audioA.addEventListener("pause", handlePauseA);
    audioB.addEventListener("pause", handlePauseB);

    return () => {
      audioA.removeEventListener("timeupdate", handleTimeUpdate);
      audioB.removeEventListener("timeupdate", handleTimeUpdate);
      audioA.removeEventListener("durationchange", handleDurationChange);
      audioB.removeEventListener("durationchange", handleDurationChange);
      audioA.removeEventListener("ended", handleEnded);
      audioB.removeEventListener("ended", handleEnded);
      audioA.removeEventListener("playing", handlePlayingA);
      audioB.removeEventListener("playing", handlePlayingB);
      audioA.removeEventListener("pause", handlePauseA);
      audioB.removeEventListener("pause", handlePauseB);
    };
  }, [getActive, getInactive, loadAudio, fetchAndPlayMore, performCrossfade, preloadNext, updateMediaSession]);

  // Keep public audioRef in sync
  useEffect(() => {
    audioRef.current = getActive();
  });

  // ---- Public actions ----

  const playTrack = useCallback((track: AudioTrack, newPlaylist?: AudioTrack[]) => {
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

    if (track.type === "youtube" && !track.audioUrl) return;
    loadAudio(track);
  }, [loadAudio]);

  const pause = useCallback(() => {
    const active = getActive();
    if (active) { active.pause(); setIsPlaying(false); }
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  }, [getActive]);

  const resume = useCallback(() => {
    const active = getActive();
    if (active) {
      active.play()
        .then(() => {
          setIsPlaying(true);
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        })
        .catch(err => {
          if (err.name === "NotAllowedError") {
            toast.error("Please tap play to resume playback.");
          } else {
            toast.error("Failed to resume audio.");
          }
          setIsPlaying(false);
        });
    }
  }, [getActive]);

  const stop = useCallback(() => {
    if (crossfadeRaf.current) { cancelAnimationFrame(crossfadeRaf.current); crossfadeRaf.current = null; }

    [audioARef.current, audioBRef.current].forEach(el => {
      if (el) { el.pause(); el.src = ""; }
    });
    [hlsARef, hlsBRef].forEach(ref => {
      if (ref.current) { ref.current.destroy(); ref.current = null; }
    });

    setIsPlaying(false);
    setCurrentTrack(null);
    setPlaylist([]);
    playlistRef.current = [];
    playedIds.current.clear();
    isFetchingMore.current = false;
    isCrossfading.current = false;
    preloadStarted.current = false;
    preloadedNextTrack.current = null;

    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  }, []);

  const next = useCallback(() => {
    const idx = currentIndexRef.current;
    const pl = playlistRef.current;
    if (idx < pl.length - 1) {
      const nextTrack = pl[idx + 1];
      const newIdx = idx + 1;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
      loadAudio(nextTrack, true);
    }
  }, [loadAudio]);

  const previous = useCallback(() => {
    const idx = currentIndexRef.current;
    const pl = playlistRef.current;
    if (idx > 0) {
      const prevTrack = pl[idx - 1];
      const newIdx = idx - 1;
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
      loadAudio(prevTrack, true);
    } else {
      const active = getActive();
      if (active) active.currentTime = 0;
    }
  }, [loadAudio, getActive]);

  const seek = useCallback((time: number) => {
    const active = getActive();
    if (active) { active.currentTime = time; setCurrentTime(time); }
  }, [getActive]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(Math.max(0, Math.min(1, vol)));
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) pause(); else resume();
  }, [isPlaying, pause, resume]);

  const updatePlaylist = useCallback((newPlaylist: AudioTrack[]) => {
    setPlaylist(newPlaylist);
    playlistRef.current = newPlaylist;
    if (currentTrack) {
      const idx = newPlaylist.findIndex(t => t.id === currentTrack.id);
      if (idx >= 0) { setCurrentIndex(idx); currentIndexRef.current = idx; }
    }
  }, [currentTrack]);

  return (
    <AudioPlayerContext.Provider value={{
      currentTrack, isPlaying, currentTime, duration, volume, playbackError,
      playlist, currentIndex,
      playTrack, pause, resume, stop, next, previous, seek, setVolume,
      togglePlayPause, updatePlaylist, audioRef,
    }}>
      {children}
      {/* Two hidden audio elements for crossfade */}
      <audio ref={audioARef} style={{ display: "none" }} />
      <audio ref={audioBRef} style={{ display: "none" }} />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return context;
}
