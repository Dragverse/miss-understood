"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { FiMessageSquare, FiSend, FiClock } from "react-icons/fi";

import { usePrivy } from "@privy-io/react-auth";
import { useStreamStore } from "@/lib/store/stream";
import { supabase } from "@/lib/supabase/client";

interface LivestreamEmbedProps {
  creatorDID: string;
  creatorName: string;
  creatorHandle?: string;
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
    <div className="flex flex-col h-full bg-black/70 backdrop-blur-sm overflow-hidden">
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
export function LivestreamEmbed({ creatorDID, creatorName }: LivestreamEmbedProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({ isLive: false });
  const [upcoming, setUpcoming] = useState<UpcomingStream | null>(null);

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
          setStreamInfo({ isLive: true, id: s.id, playbackId: s.playbackId, playbackUrl: s.playbackUrl, title: s.name || `${creatorName} is live!` });
        } else {
          setStreamInfo({ isLive: false });
        }
        setUpcoming(data.upcoming?.length > 0 ? { title: data.upcoming[0].name || "Upcoming Stream", scheduledAt: data.upcoming[0].scheduledAt } : null);
      } catch {
        // silent
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [creatorDID, creatorName]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectivePlaybackId = streamInfo.playbackId ?? (isOwnActiveStream ? activeStream?.playbackId : undefined);
  const playbackUrl = streamInfo.playbackUrl || (effectivePlaybackId ? `https://livepeercdn.studio/hls/${effectivePlaybackId}/index.m3u8` : null);

  const chatChannelId = streamInfo.id ?? effectivePlaybackId ?? creatorDID;
  const isConnecting = isOwnActiveStream && !streamInfo.isLive;

  // ── Always render the same grid shell; content switches by state ──────────
  return (
    <div className="w-full">
      <div className={`grid grid-cols-1 lg:h-[400px] ${streamInfo.isLive ? "lg:grid-cols-[1fr_300px]" : ""}`}>

        {/* ── Player column ── */}
        <div className="relative aspect-video lg:aspect-auto lg:h-full bg-black overflow-hidden">

          {streamInfo.isLive && playbackUrl ? (
            <>
              {/* @livepeer/react Player — handles HLS/WebRTC/CORS correctly */}
              <Player.Root src={getSrc(playbackUrl)} autoPlay volume={0}>
                <Player.Container className="w-full h-full">
                  <Player.Video className="w-full h-full object-cover" />
                  <Player.Controls autoHide={3000} className="p-3">
                    <div className="flex items-center gap-3">
                      <Player.MuteTrigger className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" aria-label="Mute" />
                      <Player.FullscreenTrigger className="ml-auto w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition" aria-label="Fullscreen" />
                    </div>
                  </Player.Controls>
                </Player.Container>
              </Player.Root>

              {/* LIVE badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-md text-xs font-bold text-white shadow-lg pointer-events-none">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>

              {/* Stream title */}
              {streamInfo.title && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium max-w-[60%] truncate pointer-events-none">
                  {streamInfo.title}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Offline / connecting background */}
              <Image
                src="/currently-offline.jpg"
                alt="Stream currently offline"
                fill
                className="object-cover"
              />

              {/* Status badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-xs font-bold text-white/70 shadow-lg border border-white/10">
                {isConnecting ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    CONNECTING
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    OFFLINE
                  </>
                )}
              </div>

              {/* Upcoming stream pill */}
              {upcoming && (
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full border border-[#EB83EA]/30">
                  <FiClock className="w-3.5 h-3.5 text-[#EB83EA] flex-shrink-0" />
                  <span className="text-white text-xs font-medium truncate max-w-[200px]">{upcoming.title}</span>
                  <span className="text-gray-400 text-xs flex-shrink-0">· {formatDate(upcoming.scheduledAt)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Chat column — desktop only, only when live ── */}
        {streamInfo.isLive && (
          <div className="hidden lg:block h-full border-l border-white/10">
            <ChatPanel channelId={chatChannelId} />
          </div>
        )}
      </div>

      {/* Divider between player and creator info */}
      <div className="h-px bg-white/10" />
    </div>
  );
}
