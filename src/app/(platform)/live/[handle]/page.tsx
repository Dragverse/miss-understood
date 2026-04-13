"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Hls from "hls.js";
import { usePrivy } from "@privy-io/react-auth";
import {
  FiArrowLeft,
  FiVolume2,
  FiVolumeX,
  FiMaximize2,
  FiUsers,
  FiSend,
  FiMessageSquare,
} from "react-icons/fi";
import { supabase } from "@/lib/supabase/client";
import { useStreamStore } from "@/lib/store/stream";

interface Creator {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  verified: boolean;
}

interface StreamInfo {
  id: string;
  title: string;
  playbackId: string;
  playbackUrl: string;
  startedAt: string | null;
}

interface ChatMessage {
  id: string;
  text: string;
  userName: string;
  userAvatar: string;
  ts: number;
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({ channelId }: { channelId: string }) {
  const { user, authenticated, login } = usePrivy();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [userInfo, setUserInfo] = useState<{ name: string; avatar: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Fetch user display info once authenticated
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setUserInfo({
            name: d.profile.display_name || d.profile.handle || "Viewer",
            avatar: d.profile.avatar || "/defaultpfp.png",
          });
        }
      })
      .catch(() => {});
  }, [authenticated, user?.id]);

  // Supabase broadcast channel
  useEffect(() => {
    if (!supabase) return;

    const ch = supabase.channel(`live-chat:${channelId}`, {
      config: { broadcast: { self: true } },
    });

    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev.slice(-199), payload as ChatMessage];
      });
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [channelId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !supabase || !channelRef.current) return;

    const info = userInfo ?? { name: "Viewer", avatar: "/defaultpfp.png" };
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      userName: info.name,
      userAvatar: info.avatar,
      ts: Date.now(),
    };

    setInput("");
    await channelRef.current.send({ type: "broadcast", event: "msg", payload: msg });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a0b2e] border border-[#2f2942] rounded-[20px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2f2942] flex items-center gap-2 flex-shrink-0">
        <FiMessageSquare className="w-4 h-4 text-[#EB83EA]" />
        <h3 className="text-sm font-bold text-white">Live Chat</h3>
        {messages.length > 0 && (
          <span className="text-gray-500 text-xs ml-auto">{messages.length}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">
            No messages yet. Be the first!
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <Image
                src={m.userAvatar}
                alt={m.userName}
                width={24}
                height={24}
                className="rounded-full object-cover flex-shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#EB83EA]">{m.userName} </span>
                <span className="text-sm text-gray-300 break-words">{m.text}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2f2942] flex-shrink-0">
        {authenticated ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something…"
              maxLength={300}
              className="flex-1 px-3 py-2 bg-[#2f2942] border border-[#EB83EA]/20 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-full bg-[#EB83EA] hover:bg-[#E748E6] flex items-center justify-center transition disabled:opacity-40 flex-shrink-0"
              aria-label="Send message"
            >
              <FiSend className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => login()}
            className="w-full py-2 text-sm text-[#EB83EA] hover:text-[#E748E6] font-semibold transition"
          >
            Sign in to chat
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page content (needs useSearchParams → must be inside Suspense) ───────
function LivePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const handle = params.handle as string;
  const { user } = usePrivy();

  // ?p= bypasses DB lookup — works even if DB insert failed
  const directPlaybackId = searchParams.get("p");

  // If the viewer is the creator who just went live, use the store playbackId
  // as an immediate fallback before the DB syncs (same pattern as profile embed)
  const activeStream = useStreamStore((s) => s.activeStream);
  const isOwnStream = activeStream?.creatorDID === user?.id;
  const storePlaybackId = isOwnStream ? activeStream?.playbackId ?? null : null;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // playerKey increments whenever we need to (re)initialise the HLS player.
  // Using a key avoids the fragile boolean-expression dependency array trick.
  const [playerKey, setPlayerKey] = useState(0);

  // Stream playback state machine
  // 'connecting'  — player set up, waiting for first frame
  // 'playing'     — video is rendering live content
  // 'ended'       — stream stopped or never started
  // 'offline'     — no playback source and API found no active stream
  type StreamState = "connecting" | "playing" | "ended" | "offline";
  const initialState: StreamState =
    directPlaybackId || storePlaybackId ? "connecting" : "offline";
  const [streamState, setStreamState] = useState<StreamState>(initialState);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const [diagLines, setDiagLines] = useState<string[]>([]);
  const [needsTap, setNeedsTap] = useState(false);


  const playbackUrl =
    stream?.playbackUrl ??
    (directPlaybackId
      ? `https://livepeercdn.studio/hls/${directPlaybackId}/index.m3u8`
      : null) ??
    (storePlaybackId
      ? `https://livepeercdn.studio/hls/${storePlaybackId}/index.m3u8`
      : null);

  // Chat channel — lock to the first stable ID we get (playbackId is always
  // available when live; stream.id arrives after DB sync). Locking prevents
  // the chat room from changing mid-session when the DB record syncs in.
  const chatChannelIdRef = useRef<string | null>(null);
  if (!chatChannelIdRef.current && (stream?.id || directPlaybackId || storePlaybackId)) {
    chatChannelIdRef.current = stream?.id ?? directPlaybackId ?? storePlaybackId ?? handle;
  }
  const chatChannelId = chatChannelIdRef.current ?? handle;

  // Fetch creator + stream from API
  useEffect(() => {
    const fetchInfo = async () => {
      pollCountRef.current += 1;
      const attempt = pollCountRef.current;
      try {
        const params = new URLSearchParams({ handle });
        if (directPlaybackId) params.set("p", directPlaybackId);
        const res = await fetch(`/api/stream/live?${params}`);
        if (!res.ok) {
          setDiagLines([`Poll #${attempt}: API returned ${res.status}`]);
          return;
        }
        const data = await res.json();
        if (data.creator) setCreator(data.creator);
        if (data.stream) {
          setDiagLines([`Poll #${attempt}: stream found ✓ (id: ${data.stream.id?.slice(0,8)}…)`]);
          setStream(data.stream);
          // Allow recovery: if we were offline or gave up, reinit the player
          setStreamState((prev) => {
            if (prev === "offline" || prev === "ended") {
              setPlayerKey((k) => k + 1);
              return "connecting";
            }
            return prev;
          });
        } else if (!directPlaybackId && !storePlaybackId) {
          // No ?p= and no store fallback — creator genuinely offline
          setDiagLines([`Poll #${attempt}: no active stream, no ?p= — offline`]);
          setStreamState("offline");
        } else {
          setDiagLines([`Poll #${attempt}: no active stream found — checking HLS…`]);
        }
      } catch (e) {
        setDiagLines([`Poll #${attempt}: fetch error — ${e instanceof Error ? e.message : "unknown"}`]);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
    pollingRef.current = setInterval(fetchInfo, 15_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [handle, directPlaybackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unblock loading immediately when ?p= is present (API result enriches later)
  useEffect(() => {
    if (directPlaybackId) setLoading(false);
  }, [directPlaybackId]);

  // HLS player — re-runs when playbackUrl changes or playerKey increments
  useEffect(() => {
    if (!playbackUrl || streamState === "offline") return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let effectActive = true;
    let iosErrorListener: (() => void) | null = null;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const onPlaying = () => setStreamState("playing");
    const onEnded   = () => setStreamState("ended");
    videoEl.addEventListener("playing", onPlaying);
    videoEl.addEventListener("ended",   onEnded);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { videoEl.play().catch(() => {}); });
      // Never give up — CDN needs time to start HLS delivery after WHIP connects.
      // API polling decides when the stream is truly over (sets state to offline/ended).
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        setDiagLines(prev => [...prev.slice(-2), `HLS error — retrying in 5s (${data.type})`]);
        setTimeout(() => {
          if (effectActive && hlsRef.current === hls) hls.loadSource(playbackUrl);
        }, 5_000);
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // iOS Safari native HLS — do NOT call load() before play() (causes AbortError)
      const tryPlay = () => {
        videoEl.src = playbackUrl;
        videoEl.play().catch(() => { setNeedsTap(true); });
      };
      iosErrorListener = () => {
        if (!effectActive) return;
        setDiagLines(prev => [...prev.slice(-2), `iOS HLS error — retrying in 5s`]);
        setTimeout(() => { if (effectActive) tryPlay(); }, 5_000);
      };
      videoEl.addEventListener("error", iosErrorListener);
      tryPlay();
    } else {
      setStreamState("ended");
    }

    return () => {
      effectActive = false;
      videoEl.removeEventListener("playing", onPlaying);
      videoEl.removeEventListener("ended",   onEnded);
      if (iosErrorListener) videoEl.removeEventListener("error", iosErrorListener);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [playbackUrl, playerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mute
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA]" />
      </div>
    );
  }

  const isPlayerVisible = streamState !== "offline";

  return (
    <div className="min-h-screen bg-[#0f071a]">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <Link
          href={creator ? `/u/${creator.handle}` : "/"}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
        >
          <FiArrowLeft className="w-4 h-4" />
          {creator ? `Back to ${creator.displayName}'s profile` : "Back"}
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 space-y-5">
        {/* Creator header */}
        {creator && (
          <div className="flex items-center gap-4">
            <Link href={`/u/${creator.handle}`}>
              <Image
                src={creator.avatar}
                alt={creator.displayName}
                width={52}
                height={52}
                className="rounded-full object-cover ring-2 ring-[#EB83EA]/40"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/u/${creator.handle}`} className="font-bold text-white text-lg hover:text-[#EB83EA] transition">
                  {creator.displayName}
                </Link>
                {(streamState === "playing" || streamState === "connecting") && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold uppercase tracking-wider">LIVE</span>
                  </div>
                )}
              </div>
              {stream?.title && (
                <p className="text-gray-300 text-sm mt-0.5 truncate">{stream.title}</p>
              )}
            </div>
          </div>
        )}

        {/* Player + Chat grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* Player column */}
          <div className="space-y-4">
            {isPlayerVisible ? (
              <div
                ref={containerRef}
                className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden group"
              >
                {/* Video element always mounted when player is visible */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />

                {/* Connecting overlay */}
                {streamState === "connecting" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 px-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#EB83EA]" />
                    <p className="text-gray-300 text-sm font-medium">Connecting to stream…</p>
                    {needsTap && (
                      <button
                        onClick={() => { videoRef.current?.play().catch(() => {}); setNeedsTap(false); }}
                        className="mt-1 px-5 py-2.5 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full text-sm font-bold transition shadow-lg"
                      >
                        Tap to play
                      </button>
                    )}
                    {/* Diagnostic panel — helps debug detection issues */}
                    {diagLines.length > 0 && (
                      <div className="mt-2 w-full max-w-xs bg-black/60 border border-white/10 rounded-lg p-3 space-y-1">
                        {diagLines.map((l, i) => (
                          <p key={i} className="text-white/50 text-[10px] font-mono leading-snug break-all">{l}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Stream ended overlay */}
                {streamState === "ended" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                      <FiUsers className="w-6 h-6 text-gray-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold">Stream has ended</p>
                      <p className="text-gray-400 text-sm mt-1">This stream is no longer live.</p>
                    </div>
                    {creator && (
                      <Link
                        href={`/u/${creator.handle}`}
                        className="px-5 py-2 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 text-[#EB83EA] rounded-full text-sm font-semibold transition"
                      >
                        Visit Profile
                      </Link>
                    )}
                  </div>
                )}

                {/* Controls overlay — only when playing */}
                {streamState === "playing" && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                    <button
                      onClick={() => setIsMuted((m) => !m)}
                      className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <FiVolumeX className="w-4 h-4 text-white" /> : <FiVolume2 className="w-4 h-4 text-white" />}
                    </button>
                    <button
                      onClick={handleFullscreen}
                      className="ml-auto w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition"
                      aria-label="Fullscreen"
                    >
                      <FiMaximize2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Offline / not streaming */
              <div className="w-full aspect-video bg-[#1a0b2e] border border-[#2f2942] rounded-[20px] flex flex-col items-center justify-center gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <FiUsers className="w-7 h-7 text-gray-500" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    {creator ? `${creator.displayName} is not live right now` : "Stream not found"}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {creator
                      ? "Check back later or visit their profile."
                      : "This stream may have ended or the link has expired."}
                  </p>
                </div>
                {creator && (
                  <Link
                    href={`/u/${creator.handle}`}
                    className="px-5 py-2 bg-[#EB83EA]/20 hover:bg-[#EB83EA]/30 text-[#EB83EA] rounded-full text-sm font-semibold transition"
                  >
                    Visit Profile
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Chat column — always visible */}
          <div className="h-[500px] lg:h-auto lg:min-h-[400px]">
            <ChatPanel channelId={chatChannelId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page wrapper — Suspense required for useSearchParams in App Router ─────────
export default function LivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA]" />
        </div>
      }
    >
      <LivePageContent />
    </Suspense>
  );
}
