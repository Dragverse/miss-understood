"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Hls from "hls.js";
import { FiVolume2, FiVolumeX, FiMaximize2, FiMessageSquare, FiSend, FiClock } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { useStreamStore } from "@/lib/store/stream";
import { supabase } from "@/lib/supabase/client";

interface LivestreamEmbedProps {
  creatorDID: string;
  creatorName: string;
  creatorHandle?: string;
  bannerUrl?: string;
}

interface StreamInfo {
  id?: string;
  isLive: boolean;
  playbackId?: string;
  playbackUrl?: string;
  title?: string;
}

interface UpcomingStream {
  title: string;
  scheduledAt: string;
}

interface ChatMessage {
  id: string;
  text: string;
  userName: string;
  userAvatar: string;
  ts: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Inline chat panel ─────────────────────────────────────────────────────────
function ChatPanel({ channelId }: { channelId: string }) {
  const { authenticated, login } = usePrivy();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [userInfo, setUserInfo] = useState<{ name: string; avatar: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/user/me").then(r => r.json()).then(d => {
      if (d.profile) setUserInfo({ name: d.profile.display_name || d.profile.handle || "Viewer", avatar: d.profile.avatar || "/defaultpfp.png" });
    }).catch(() => {});
  }, [authenticated]);

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`live-chat:${channelId}`, { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev.slice(-199), payload as ChatMessage]);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); channelRef.current = null; };
  }, [channelId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !channelRef.current) return;
    const info = userInfo ?? { name: "Viewer", avatar: "/defaultpfp.png" };
    const msg: ChatMessage = { id: `${Date.now()}-${Math.random()}`, text, userName: info.name, userAvatar: info.avatar, ts: Date.now() };
    setInput("");
    await channelRef.current.send({ type: "broadcast", event: "msg", payload: msg });
  };

  return (
    <div className="flex flex-col h-full bg-black/60 backdrop-blur-sm border-l border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 flex-shrink-0">
        <FiMessageSquare className="w-4 h-4 text-[#EB83EA]" />
        <h3 className="text-sm font-bold text-white">Live Chat</h3>
        {messages.length > 0 && <span className="text-gray-500 text-xs ml-auto">{messages.length}</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">No messages yet. Be the first!</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className="flex gap-2">
              <Image src={m.userAvatar} alt={m.userName} width={24} height={24} className="rounded-full object-cover flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#EB83EA]">{m.userName} </span>
                <span className="text-sm text-gray-300 break-words">{m.text}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        {authenticated ? (
          <div className="flex gap-2">
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Say something…" maxLength={300}
              className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA]"
            />
            <button onClick={sendMessage} disabled={!input.trim()} className="w-9 h-9 rounded-full bg-[#EB83EA] hover:bg-[#E748E6] flex items-center justify-center transition disabled:opacity-40 flex-shrink-0" aria-label="Send message">
              <FiSend className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button onClick={() => login()} className="w-full py-2 text-sm text-[#EB83EA] hover:text-[#E748E6] font-semibold transition">
            Sign in to chat
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LivestreamEmbed({ creatorDID, creatorName, creatorHandle, bannerUrl }: LivestreamEmbedProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({ isLive: false });
  const [upcoming, setUpcoming] = useState<UpcomingStream | null>(null);
  const [checking, setChecking] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeStream = useStreamStore((s) => s.activeStream);
  const isOwnActiveStream = activeStream?.creatorDID === creatorDID;

  // Poll stream status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/stream/by-creator?creatorDID=${encodeURIComponent(creatorDID)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.streams?.length > 0) {
          const s = data.streams[0];
          setStreamInfo(prev => {
            if (!prev.isLive) setPlayerError(false);
            return { isLive: true, id: s.id, playbackId: s.playbackId, playbackUrl: s.playbackUrl, title: s.name || `${creatorName} is live!` };
          });
        } else {
          setStreamInfo({ isLive: false });
        }
        setUpcoming(data.upcoming?.length > 0 ? { title: data.upcoming[0].name || "Upcoming Stream", scheduledAt: data.upcoming[0].scheduledAt } : null);
      } catch {
        // silent
      } finally {
        setChecking(false);
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]); // eslint-disable-line react-hooks/exhaustive-deps

  const [playerError, setPlayerError] = useState(false);

  const effectivePlaybackId = streamInfo.playbackId ?? (isOwnActiveStream ? activeStream?.playbackId : undefined);
  const playbackUrl = streamInfo.playbackUrl || (effectivePlaybackId ? `https://livepeercdn.studio/hls/${effectivePlaybackId}/index.m3u8` : null);

  // HLS setup
  useEffect(() => {
    if (!streamInfo.isLive || !playbackUrl) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setPlayerError(false);
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { videoEl.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setPlayerError(true); });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = playbackUrl;
      videoEl.play().catch(() => {});
    } else {
      setPlayerError(true);
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [streamInfo.isLive, playbackUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (videoRef.current) videoRef.current.muted = isMuted; }, [isMuted]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
  };

  const chatChannelId = streamInfo.id ?? effectivePlaybackId ?? creatorDID;

  // ── Connecting state (own stream, DB not synced yet) ──────────────────────
  if (isOwnActiveStream && !streamInfo.isLive) {
    return (
      <div className="w-full h-[380px] md:h-[480px] bg-black/60 border-b border-red-500/30 flex flex-col items-center justify-center gap-3">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-400 font-bold uppercase tracking-widest text-sm">Connecting…</span>
        <p className="text-gray-400 text-sm">Your stream is starting. It will appear here in a moment.</p>
      </div>
    );
  }

  // ── Live ──────────────────────────────────────────────────────────────────
  if (streamInfo.isLive && playbackUrl) {
    return (
      <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_320px]" style={{ height: "clamp(320px, 55vw, 520px)" }}>
        {/* Player */}
        <div ref={containerRef} className="relative bg-black group h-full overflow-hidden">
          {/* LIVE badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-md text-xs font-bold text-white shadow-lg">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
          {streamInfo.title && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm font-medium max-w-xs truncate">
              {streamInfo.title}
            </div>
          )}
          {playerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
              <p className="text-gray-400 text-sm">Stream temporarily unavailable</p>
              <button onClick={() => setPlayerError(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition">Retry</button>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                <button onClick={() => setIsMuted(m => !m)} className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" aria-label={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <FiVolumeX className="w-4 h-4 text-white" /> : <FiVolume2 className="w-4 h-4 text-white" />}
                </button>
                <button onClick={handleFullscreen} className="ml-auto w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" aria-label="Fullscreen">
                  <FiMaximize2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </>
          )}
        </div>
        {/* Chat */}
        <ChatPanel channelId={chatChannelId} />
      </div>
    );
  }

  // ── Offline / loading ─────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[380px] md:h-[480px] overflow-hidden bg-[#0f071a]">
      {/* Banner as background */}
      {bannerUrl ? (
        <Image src={bannerUrl} alt="Profile banner" fill className="object-cover" priority />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA]/20 via-[#7c3aed]/20 to-[#1a0b2e]" />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Centered TV test-pattern card */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {/* Test pattern stripes */}
          <div className="absolute inset-0 flex">
            {["#c0c0c0","#c0c000","#00c0c0","#00c000","#c000c0","#c00000","#0000c0","#000000"].map((c, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          {/* Bottom black bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-black" />
          {/* CURRENTLY OFFLINE text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-[#ffe600] font-black text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight drop-shadow-lg" style={{ fontFamily: "var(--font-heading, sans-serif)", WebkitTextStroke: "2px rgba(0,0,0,0.4)" }}>
              Currently
            </span>
            <span className="text-[#ffe600] font-black text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight drop-shadow-lg" style={{ fontFamily: "var(--font-heading, sans-serif)", WebkitTextStroke: "2px rgba(0,0,0,0.4)" }}>
              Offline
            </span>
          </div>
          {/* OFFLINE badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/90 rounded-md">
            <span className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-gray-200 text-xs font-bold uppercase tracking-wide">Offline</span>
          </div>
        </div>
      </div>

      {/* Upcoming stream banner */}
      {upcoming && !checking && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full border border-[#EB83EA]/30">
          <FiClock className="w-3.5 h-3.5 text-[#EB83EA]" />
          <span className="text-white text-sm font-medium">{upcoming.title}</span>
          <span className="text-gray-400 text-xs">· {formatDate(upcoming.scheduledAt)}</span>
        </div>
      )}

      {/* Link to stream page when a handle is available */}
      {creatorHandle && (
        <Link href={`/live/${creatorHandle}`} className="absolute inset-0" aria-label="View stream page" />
      )}
    </div>
  );
}
