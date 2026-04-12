"use client";

import { useState, useEffect, useRef } from "react";
import {
  useRoom,
  useLocalPeer,
  useLocalAudio,
  useLocalVideo,
  usePeerIds,
  useDataMessage,
  useRemotePeer,
} from "@huddle01/react/hooks";
import type { TPermissions } from "@huddle01/web-core/types";
import { useRoomStore } from "@/lib/store/room";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthUser } from "@/lib/privy/hooks";
import { SpeakerCard, LocalSpeakerCard } from "./speaker-card";
import { CreateRoomForm } from "./create-room-form";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FiX, FiArrowLeft, FiRadio, FiMic, FiMicOff, FiVideo, FiVideoOff,
  FiMessageSquare, FiLogOut, FiSend, FiUsers, FiArrowUp,
} from "react-icons/fi";

type PanelView = "list" | "create" | "room";

interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  fromPeerId: string;
  isLocal?: boolean;
}

interface LiveRoom {
  huddle_room_id: string;
  title: string;
  listener_count: number;
  profiles?: { handle: string; display_name: string; avatar: string } | null;
}

// Permissions granted when host promotes a listener to speaker
const SPEAKER_PERMISSIONS: TPermissions = {
  admin: false,
  canConsume: true,
  canProduce: true,
  canProduceSources: { cam: false, mic: true, screen: false },
  canRecvData: true,
  canSendData: true,
  canUpdateMetadata: true,
};

export function VibeLounge() {
  const { getAccessToken, authenticated } = usePrivy();
  const { creator } = useAuthUser();
  const { activeRoom, isPanelOpen, openPanel, closePanel, setActiveRoom, clearActiveRoom, setMuted, isMuted } = useRoomStore();

  const [view, setView] = useState<PanelView>("list");
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [speakerRequests, setSpeakerRequests] = useState<Record<string, string>>({});
  const [requestedToSpeak, setRequestedToSpeak] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const joinAttemptRef = useRef<string | null>(null);
  const tokenRef = useRef<string>("");
  const isHostRef = useRef(false);
  const activeRoomRef = useRef<typeof activeRoom>(null);

  const displayName = creator?.displayName || "Drag Artist";
  const avatarUrl = creator?.avatar || "/defaultpfp.png";

  // Store pending metadata so onJoin can apply it after join completes
  const pendingMetadataRef = useRef<{ displayName: string; avatarUrl: string } | null>(null);

  // Huddle01 hooks
  const { joinRoom, leaveRoom, closeRoom } = useRoom({
    onJoin: () => {
      setJoined(true);
      setJoining(false);
      // updateMetadata must only be called AFTER join resolves
      if (pendingMetadataRef.current) {
        updateMetadata(pendingMetadataRef.current);
        pendingMetadataRef.current = null;
      }
    },
    onLeave: () => {
      setJoined(false);
      clearActiveRoom();
      setView("list");
      joinAttemptRef.current = null;
      setSpeakerRequests({});
      setRequestedToSpeak(false);
    },
    onFailed: () => {
      toast.error("Failed to connect to room");
      setJoining(false);
      clearActiveRoom();
      setView("list");
      joinAttemptRef.current = null;
    },
  });

  const { enableAudio, disableAudio, isAudioOn } = useLocalAudio();
  const { enableVideo, disableVideo, isVideoOn, stream: localVideoStream } = useLocalVideo();
  const { updateMetadata, permissions } = useLocalPeer<{ displayName: string; avatarUrl: string }>({
    onPermissionsUpdated: (perms) => {
      // Fired when host promotes this listener to speaker
      if (perms.canProduce) {
        toast.success("You've been invited to speak! Tap the mic to join.");
        setRequestedToSpeak(false);
      }
    },
  });

  // Current user can speak if they're the host or have been promoted
  const canSpeak = isHost || (permissions?.canProduce ?? false);

  const { peerIds: speakerPeerIds } = usePeerIds({ roles: ["host", "co-host", "speaker"] as any });
  const { peerIds: listenerPeerIds } = usePeerIds({ roles: ["listener"] as any });

  useDataMessage({
    onMessage: (payload: string, from: string) => {
      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "chat") {
          setMessages((prev) => [...prev, {
            id: `${from}-${Date.now()}`,
            displayName: parsed.displayName || "Artist",
            text: parsed.text,
            fromPeerId: from,
          }]);
        }
        // Host receives a request to speak from a listener
        if (parsed.type === "speaker-request" && isHostRef.current) {
          setSpeakerRequests((prev) => ({ ...prev, [from]: parsed.displayName || "Artist" }));
          toast(`${parsed.displayName || "Someone"} wants to speak`, { icon: "🙋" });
        }
        // Listener cancelled their request
        if (parsed.type === "speaker-cancel" && isHostRef.current) {
          setSpeakerRequests((prev) => {
            const next = { ...prev };
            delete next[from];
            return next;
          });
        }
      } catch {}
    },
  });
  const { sendData } = useDataMessage();

  // Fetch live rooms list
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRooms() {
    try {
      const res = await fetch("/api/rooms/list");
      const data = await res.json();
      if (data.rooms) setLiveRooms(data.rooms);
    } catch {}
  }

  // Auto-join when activeRoom changes
  useEffect(() => {
    if (!activeRoom) return;
    if (joinAttemptRef.current === activeRoom.roomId) return;
    joinAttemptRef.current = activeRoom.roomId;
    setView("room");
    doJoin(activeRoom.roomId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.roomId]);

  async function doJoin(roomId: string) {
    setJoining(true);
    try {
      const authToken = await getAccessToken();
      tokenRef.current = authToken ?? "";
      const params = new URLSearchParams({ roomId, displayName, avatarUrl });
      const res = await fetch(`/api/rooms/token?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Token failed");
      setIsHost(data.isHost);
      isHostRef.current = data.isHost;
      pendingMetadataRef.current = { displayName, avatarUrl };
      // Handle joinRoom failure explicitly — onFailed may not fire for all error types
      joinRoom({ roomId, token: data.token });
    } catch (err: any) {
      toast.error(err.message || "Could not join room");
      setJoining(false);
      joinAttemptRef.current = null;
      clearActiveRoom();
      setView("list");
    }
  }

  // Keep refs in sync for beforeunload (stale closure avoidance)
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // End room if host closes tab / browser
  useEffect(() => {
    const handleUnload = () => {
      if (!isHostRef.current || !activeRoomRef.current?.roomId || !tokenRef.current) return;
      fetch("/api/rooms/end", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        keepalive: true,
        body: JSON.stringify({ roomId: activeRoomRef.current.roomId }),
      });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Auto-mute room mic when AudioPlayerContext requests it (e.g. user plays a song)
  useEffect(() => {
    if (isMuted && isAudioOn && joined) {
      disableAudio().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleJoinRoom = (room: LiveRoom) => {
    if (!authenticated) { toast.error("Sign in to join a room"); return; }
    const hostName = room.profiles?.display_name || room.profiles?.handle || "Host";
    const hostAvatar = room.profiles?.avatar || "/defaultpfp.png";
    setActiveRoom({ roomId: room.huddle_room_id, title: room.title, hostName, hostAvatar, isHost: false });
    openPanel();
  };

  const handleMuteToggle = async () => {
    try {
      if (isAudioOn) { await disableAudio(); setMuted(true); }
      else { await enableAudio(); setMuted(false); }
    } catch { toast.error("Could not toggle mic"); }
  };

  const handleVideoToggle = async () => {
    try {
      if (isVideoOn) await disableVideo(); else await enableVideo();
    } catch { toast.error("Could not toggle camera"); }
  };

  const handleLeave = async () => {
    if (isHost) {
      try {
        const authToken = await getAccessToken();
        const res = await fetch("/api/rooms/end", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ roomId: activeRoom?.roomId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || "Failed to end room");
        }
      } catch {
        toast.error("Could not reach server to end room");
      }
      try { closeRoom(); } catch {}
    } else {
      try { leaveRoom(); } catch {}
    }
    clearActiveRoom();
    setView("list");
    joinAttemptRef.current = null;
    setSpeakerRequests({});
    setRequestedToSpeak(false);
    fetchRooms();
  };

  const handleRequestToSpeak = () => {
    if (requestedToSpeak) {
      setRequestedToSpeak(false);
      sendData({ to: "*", payload: JSON.stringify({ type: "speaker-cancel", displayName }), label: "hand" });
    } else {
      setRequestedToSpeak(true);
      sendData({ to: "*", payload: JSON.stringify({ type: "speaker-request", displayName }), label: "hand" });
      toast.success("Request sent to host!");
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, displayName, text, fromPeerId: "local", isLocal: true }]);
    sendData({ to: "*", payload: JSON.stringify({ type: "chat", displayName, text }), label: "chat" });
  };

  // ── Compact card (panel closed, but in room) ──────────────────────────────

  if (!isPanelOpen && activeRoom) {
    return (
      <div className="fixed bottom-20 right-4 z-[60] w-72 bg-[#1a0b2e] border border-[#EB83EA]/40 rounded-2xl shadow-2xl shadow-[#EB83EA]/10 overflow-hidden">
        <button onClick={openPanel} className="w-full px-4 py-3 flex items-center gap-3 text-left">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-[9px] font-black uppercase tracking-widest">Live</span>
            </div>
            <p className="text-white font-bold text-xs truncate">{activeRoom.title}</p>
            <p className="text-[#EB83EA] text-[10px] truncate">{activeRoom.hostName}</p>
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canSpeak && (
              <button
                onClick={handleMuteToggle}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isAudioOn ? "bg-[#EB83EA] text-white" : "bg-white/10 text-gray-400"}`}
                aria-label="Toggle mic"
              >
                {isAudioOn ? <FiMic className="w-3.5 h-3.5" /> : <FiMicOff className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={handleLeave} className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center" aria-label="Leave room">
              <FiLogOut className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </button>
      </div>
    );
  }

  if (!isPanelOpen) return null;

  // ── Full panel ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-[54] bg-black/40 lg:hidden" onClick={closePanel} />

      {/* Panel */}
      <div className="fixed top-16 right-0 bottom-0 z-[55] w-80 bg-[#0f071a] border-l border-[#2f2942] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2f2942] flex-shrink-0">
          {(view === "create" || (view === "room" && !joined && !joining)) && (
            <button onClick={() => setView("list")} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10" aria-label="Back">
              <FiArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <FiRadio className="w-4 h-4 text-[#EB83EA] flex-shrink-0" />
          <span className="text-white font-black text-sm uppercase tracking-widest flex-1 truncate">
            {view === "room" && activeRoom ? activeRoom.title : "Vibe Lounge"}
          </span>
          <button onClick={closePanel} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 flex-shrink-0" aria-label="Close">
            <FiX className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">

          {/* ── AUTH GATE ── */}
          {!authenticated && view !== "room" && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <FiRadio className="w-10 h-10 text-[#EB83EA]/40" />
              <p className="text-white font-bold text-sm">Sign in to join the Vibe Lounge</p>
              <p className="text-gray-500 text-xs">Listen to live audio rooms and connect with the community.</p>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] text-white text-sm font-bold"
                onClick={closePanel}
              >
                Sign in
              </Link>
            </div>
          )}

          {/* LIST VIEW */}
          {authenticated && view === "list" && (
            <div className="p-4 flex flex-col gap-4">
              <button
                onClick={() => setView("create")}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#EB83EA]/20"
              >
                <FiRadio className="w-4 h-4" />
                Go Live
              </button>

              {liveRooms.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Live Now</span>
                  {liveRooms.map((room) => {
                    const hostName = room.profiles?.display_name || room.profiles?.handle || "Host";
                    return (
                      <button
                        key={room.huddle_room_id}
                        onClick={() => handleJoinRoom(room)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#EB83EA]/30 transition-all text-left"
                      >
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold line-clamp-1">{room.title}</p>
                          <p className="text-gray-500 text-[10px]">{hostName} · {room.listener_count} listening</p>
                        </div>
                        <FiUsers className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-600 text-xs text-center py-4">No rooms live · be the first!</p>
              )}
            </div>
          )}

          {/* CREATE VIEW */}
          {authenticated && view === "create" && (
            <div className="p-4">
              <CreateRoomForm
                onCreated={() => {
                  setView("room");
                }}
              />
            </div>
          )}

          {/* ROOM VIEW */}
          {view === "room" && (
            <div className="flex flex-col h-full">
              {/* Joining spinner */}
              {(joining || (!joined && activeRoom)) && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-3 border-[#EB83EA] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
                  <p className="text-gray-400 text-sm">Connecting...</p>
                  <button onClick={handleLeave} className="text-gray-600 text-xs hover:text-red-400 transition-colors mt-2">Cancel</button>
                </div>
              )}

              {/* Room content (once joined) */}
              {joined && activeRoom && (
                <div className="flex flex-col flex-1">
                  {/* Room meta */}
                  <div className="px-4 py-3 border-b border-[#2f2942]">
                    <p className="text-gray-400 text-xs">Hosted by @{activeRoom.hostName}</p>
                    {!canSpeak && (
                      <p className="text-gray-600 text-[10px] mt-0.5">You're listening · request to speak below</p>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-6">
                    {/* Speakers */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                          Speakers ({speakerPeerIds.length + (canSpeak ? 1 : 0)})
                        </span>
                        <span className="w-1.5 h-1.5 bg-[#EB83EA] rounded-full" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {canSpeak && (
                          <LocalSpeakerCard
                            displayName={displayName}
                            avatarUrl={avatarUrl}
                            isMicOn={isAudioOn}
                            isVideoOn={isVideoOn}
                            localVideoStream={localVideoStream}
                            isHost={isHost}
                          />
                        )}
                        {speakerPeerIds.map((peerId) => (
                          <SpeakerCard key={peerId} peerId={peerId} />
                        ))}
                      </div>
                    </div>

                    {/* Listeners */}
                    {(listenerPeerIds.length > 0 || (!canSpeak)) && (
                      <div>
                        <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                          Listeners ({listenerPeerIds.length + (!canSpeak ? 1 : 0)})
                        </span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {listenerPeerIds.slice(0, 9).map((peerId) => (
                            <MiniListenerAvatar key={peerId} peerId={peerId} />
                          ))}
                          {listenerPeerIds.length > 9 && (
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                              +{listenerPeerIds.length - 9}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Host: pending speaker requests */}
                    {isHost && Object.keys(speakerRequests).length > 0 && (
                      <div>
                        <span className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                          Requesting to speak ({Object.keys(speakerRequests).length})
                        </span>
                        <div className="flex flex-col gap-1.5 mt-2">
                          {Object.entries(speakerRequests).map(([peerId, name]) => (
                            <SpeakerRequestRow
                              key={peerId}
                              peerId={peerId}
                              displayName={name}
                              onDismiss={(id) => setSpeakerRequests((prev) => {
                                const next = { ...prev };
                                delete next[id];
                                return next;
                              })}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chat */}
                    {showChat && (
                      <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-xl overflow-hidden">
                        <div className="h-40 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide">
                          {messages.length === 0 ? (
                            <p className="text-gray-600 text-xs text-center py-3">No messages yet</p>
                          ) : (
                            messages.map((msg) => (
                              <div key={msg.id} className={`flex gap-1.5 ${msg.isLocal ? "justify-end" : ""}`}>
                                {!msg.isLocal && (
                                  <span className="text-[#EB83EA] text-[10px] font-semibold shrink-0">{msg.displayName}:</span>
                                )}
                                <span className={`text-[10px] text-gray-200 ${msg.isLocal ? "text-[#EB83EA]" : ""}`}>
                                  {msg.text}
                                </span>
                              </div>
                            ))
                          )}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2 px-3 py-2 border-t border-[#2f2942]">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                            placeholder="Say something..."
                            className="flex-1 bg-transparent text-white text-xs outline-none placeholder-gray-600"
                            maxLength={200}
                          />
                          <button onClick={handleSendChat} disabled={!chatInput.trim()} className="text-[#EB83EA] disabled:opacity-40" aria-label="Send">
                            <FiSend className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="px-4 py-3 border-t border-[#2f2942] space-y-2 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">

                      {/* Speaker controls */}
                      {canSpeak && (
                        <>
                          <button
                            onClick={handleMuteToggle}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                              isAudioOn ? "bg-[#EB83EA]/20 border-[#EB83EA] text-[#EB83EA]" : "bg-white/5 border-white/10 text-gray-300"
                            }`}
                          >
                            {isAudioOn ? <FiMic className="w-3.5 h-3.5" /> : <FiMicOff className="w-3.5 h-3.5" />}
                            {isAudioOn ? "Live" : "Muted"}
                          </button>

                          {/* Camera — host only */}
                          {isHost && (
                            <button
                              onClick={handleVideoToggle}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                                isVideoOn ? "bg-[#EB83EA]/20 border-[#EB83EA] text-[#EB83EA]" : "bg-white/5 border-white/10 text-gray-300"
                              }`}
                              aria-label="Toggle camera"
                            >
                              {isVideoOn ? <FiVideo className="w-3.5 h-3.5" /> : <FiVideoOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </>
                      )}

                      {/* Listener: request to speak */}
                      {!canSpeak && (
                        <button
                          onClick={handleRequestToSpeak}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                            requestedToSpeak
                              ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                              : "bg-white/5 border-white/10 text-gray-300"
                          }`}
                        >
                          <FiArrowUp className="w-3.5 h-3.5" />
                          {requestedToSpeak ? "Requested..." : "Request to speak"}
                        </button>
                      )}

                      {/* Chat */}
                      <button
                        onClick={() => setShowChat(!showChat)}
                        className="relative flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-white/5 text-gray-300 text-xs font-semibold"
                        aria-label="Chat"
                      >
                        <FiMessageSquare className="w-3.5 h-3.5" />
                        {messages.length > 0 && !showChat && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EB83EA] rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                            {messages.length > 9 ? "9+" : messages.length}
                          </span>
                        )}
                      </button>

                      {/* Leave / End */}
                      <button
                        onClick={handleLeave}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold"
                      >
                        <FiLogOut className="w-3.5 h-3.5" />
                        {isHost ? "End" : "Leave"}
                      </button>
                    </div>

                    {/* Host admin controls */}
                    {isHost && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            sendData({ to: "*", payload: JSON.stringify({ type: "mute-all" }), label: "admin" });
                            toast.success("Muted all participants");
                          }}
                          className="flex-1 py-2 rounded-full border border-white/10 bg-white/5 text-gray-300 text-xs font-semibold"
                        >
                          Mute All
                        </button>
                        <button
                          onClick={() => setShowChat(!showChat)}
                          className="flex-1 py-2 rounded-full border border-[#EB83EA]/30 bg-[#EB83EA]/10 text-[#EB83EA] text-xs font-semibold"
                        >
                          {Object.keys(speakerRequests).length > 0 ? `Requests (${Object.keys(speakerRequests).length})` : "Chat"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniListenerAvatar({ peerId }: { peerId: string }) {
  const { metadata } = useRemotePeer<{ displayName?: string; avatarUrl?: string }>({ peerId });
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-gray-800 flex-shrink-0">
      <Image
        src={metadata?.avatarUrl || "/defaultpfp.png"}
        alt={metadata?.displayName || "Listener"}
        width={32}
        height={32}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
      />
    </div>
  );
}

// Host uses this to promote a listener to speaker
function SpeakerRequestRow({
  peerId,
  displayName,
  onDismiss,
}: {
  peerId: string;
  displayName: string;
  onDismiss: (id: string) => void;
}) {
  const { updateRole, metadata } = useRemotePeer<{ displayName?: string; avatarUrl?: string }>({ peerId });

  const handleApprove = () => {
    updateRole("speaker", { custom: SPEAKER_PERMISSIONS });
    onDismiss(peerId);
    toast.success(`${displayName} can now speak`);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
      <Image
        src={metadata?.avatarUrl || "/defaultpfp.png"}
        alt={displayName}
        width={24}
        height={24}
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
      />
      <span className="flex-1 text-xs text-white truncate">{displayName}</span>
      <button
        onClick={() => onDismiss(peerId)}
        className="text-gray-600 text-xs hover:text-gray-400 px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <button
        onClick={handleApprove}
        className="text-xs px-2.5 py-1 rounded-full bg-[#EB83EA]/20 border border-[#EB83EA]/40 text-[#EB83EA] hover:bg-[#EB83EA]/30 font-semibold transition-colors"
      >
        Invite
      </button>
    </div>
  );
}
