"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useRoom,
  useLocalPeer,
  useLocalAudio,
  useLocalVideo,
  usePeerIds,
  useDataMessage,
  useRemotePeer,
} from "@huddle01/react/hooks";
import { useRoomStore } from "@/lib/store/room";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthUser } from "@/lib/privy/hooks";
import { SpeakerCard, LocalSpeakerCard } from "./speaker-card";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiArrowUp,
  FiMessageSquare,
  FiLogOut,
  FiX,
  FiSend,
} from "react-icons/fi";

interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  fromPeerId: string;
  isLocal?: boolean;
}

interface RoomViewProps {
  roomId: string;
}

export function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { creator } = useAuthUser();
  const { activeRoom, clearActiveRoom, setMuted } = useRoomStore();

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [handRaised, setHandRaised] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup callbacks (state values aren't accessible in closures)
  const isHostRef = useRef(false);
  const joinedRef = useRef(false);
  const tokenRef = useRef("");
  const hasEndedRef = useRef(false);

  const displayName = creator?.displayName || "Drag Artist";
  const avatarUrl = creator?.avatar || "/defaultpfp.png";

  // Keep refs in sync with state so closures always see current values
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { joinedRef.current = joined; }, [joined]);

  // Huddle01 hooks
  const { joinRoom, leaveRoom, closeRoom, state: roomState } = useRoom({
    onJoin: () => { setJoined(true); setJoining(false); },
    onLeave: () => { setJoined(false); clearActiveRoom(); },
    onFailed: () => { toast.error("Failed to connect to room"); setJoining(false); },
  });

  const { enableAudio, disableAudio, isAudioOn } = useLocalAudio();
  const { enableVideo, disableVideo, isVideoOn, stream: localVideoStream } = useLocalVideo();
  const { updateMetadata, role } = useLocalPeer<{ displayName: string; avatarUrl: string; handRaised?: boolean }>();

  const { peerIds: speakerPeerIds } = usePeerIds({ roles: ["host", "co-host", "speaker"] as any });
  const { peerIds: listenerPeerIds } = usePeerIds({ roles: ["listener"] as any });

  // Text chat via data messages
  useDataMessage({
    onMessage: (payload: string, from: string) => {
      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "chat") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${from}-${Date.now()}`,
              displayName: parsed.displayName || "Artist",
              text: parsed.text,
              fromPeerId: from,
            },
          ]);
        }
      } catch {}
    },
  });

  const { sendData } = useDataMessage();

  // Fetch token and join
  useEffect(() => {
    if (!roomId || joined || joining) return;

    const joinRoomFlow = async () => {
      setJoining(true);
      try {
        const authToken = await getAccessToken();
        tokenRef.current = authToken ?? "";
        const params = new URLSearchParams({
          roomId,
          displayName,
          avatarUrl,
        });

        const res = await fetch(`/api/rooms/token?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Token failed");

        setIsHost(data.isHost);
        joinRoom({ roomId, token: data.token });
        updateMetadata({ displayName, avatarUrl });
      } catch (err: any) {
        toast.error(err.message || "Could not join room");
        setJoining(false);
      }
    };

    joinRoomFlow();
  }, [roomId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMuteToggle = async () => {
    try {
      if (isAudioOn) {
        await disableAudio();
        setMuted(true);
      } else {
        await enableAudio();
        setMuted(false);
      }
    } catch {
      toast.error("Could not toggle mic");
    }
  };

  const handleVideoToggle = async () => {
    try {
      if (isVideoOn) {
        await disableVideo();
      } else {
        await enableVideo();
      }
    } catch {
      toast.error("Could not toggle camera");
    }
  };

  const handleLeave = async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    try {
      if (isHost) {
        await fetch("/api/rooms/end", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current || await getAccessToken()}`,
          },
          body: JSON.stringify({ roomId }),
        });
        closeRoom();
      } else {
        leaveRoom();
      }
    } catch {
      // best effort
    }
    clearActiveRoom();
    router.push("/rooms");
  };

  // Cleanup on unmount (in-app navigation) and tab close
  useEffect(() => {
    const cleanup = () => {
      if (hasEndedRef.current || !joinedRef.current) return;
      hasEndedRef.current = true;
      if (isHostRef.current) {
        // keepalive ensures the request survives page unload
        fetch("/api/rooms/end", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ roomId }),
          keepalive: true,
        }).catch(() => {});
        closeRoom();
      } else {
        leaveRoom();
      }
      clearActiveRoom();
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup(); // fires on in-app navigation (component unmount)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, displayName, text, fromPeerId: "local", isLocal: true },
    ]);

    sendData({
      to: "*",
      payload: JSON.stringify({ type: "chat", displayName, text }),
      label: "chat",
    });
  };

  const handleRaiseHand = async () => {
    const next = !handRaised;
    setHandRaised(next);
    await updateMetadata({ displayName, avatarUrl, handRaised: next });
    sendData({
      to: "*",
      payload: JSON.stringify({ type: "hand", displayName, raised: next }),
      label: "hand",
    });
    if (next) toast.success("Hand raised! The host will see this.");
  };

  const title = activeRoom?.title || "Audio Room";
  const hostName = activeRoom?.hostName || "Host";

  if (joining || roomState === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[#EB83EA] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Joining room...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Room header */}
      <div className="mb-6">
        <h1 className="text-white font-black text-2xl leading-tight">{title}</h1>
        <p className="text-gray-400 text-sm mt-1">Hosted by @{hostName}</p>
      </div>

      {/* Speakers */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
            Speakers ({speakerPeerIds.length + (joined ? 1 : 0)})
          </span>
          <span className="w-2 h-2 bg-[#EB83EA] rounded-full" />
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Local peer (self) if speaker */}
          {joined && (isHost || role === "speaker" || role === "co-host") && (
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
      {listenerPeerIds.length > 0 && (
        <div className="mb-6">
          <span className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
            Listeners ({listenerPeerIds.length + (joined && role === "listener" ? 1 : 0)})
          </span>
          <div className="flex flex-wrap gap-2 mt-3">
            {listenerPeerIds.slice(0, 7).map((peerId) => (
              <ListenerAvatar key={peerId} peerId={peerId} />
            ))}
            {listenerPeerIds.length > 7 && (
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs text-gray-400 font-bold">
                +{listenerPeerIds.length - 7}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Chat */}
      {showChat && (
        <div className="mb-4 bg-[#1a0b2e] border border-[#2f2942] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2f2942]">
            <span className="text-sm font-bold text-white">Chat</span>
            <button onClick={() => setShowChat(false)} aria-label="Close chat">
              <FiX className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          </div>
          <div className="h-48 overflow-y-auto px-4 py-3 space-y-2 scrollbar-hide">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.isLocal ? "justify-end" : ""}`}>
                  {!msg.isLocal && (
                    <span className="text-[#EB83EA] text-xs font-semibold shrink-0">{msg.displayName}:</span>
                  )}
                  <span className={`text-xs text-gray-200 ${msg.isLocal ? "text-right text-[#EB83EA]" : ""}`}>
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
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
              maxLength={200}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="text-[#EB83EA] hover:text-[#E748E6] disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Mute toggle */}
        <button
          onClick={handleMuteToggle}
          disabled={!joined}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all disabled:opacity-40 ${
            isAudioOn
              ? "bg-[#EB83EA]/20 border-[#EB83EA] text-[#EB83EA]"
              : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
          }`}
        >
          {isAudioOn ? <FiMic className="w-4 h-4" /> : <FiMicOff className="w-4 h-4" />}
          <span className="hidden sm:inline">{isAudioOn ? "Muted Off" : "Muted"}</span>
        </button>

        {/* Video toggle (host / speakers only) */}
        {joined && (isHost || role === "speaker" || role === "co-host") && (
          <button
            onClick={handleVideoToggle}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all ${
              isVideoOn
                ? "bg-[#EB83EA]/20 border-[#EB83EA] text-[#EB83EA]"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
            }`}
            aria-label="Toggle camera"
          >
            {isVideoOn ? <FiVideo className="w-4 h-4" /> : <FiVideoOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{isVideoOn ? "Cam On" : "Camera"}</span>
          </button>
        )}

        {/* Raise hand (listeners) */}
        {!isHost && joined && (
          <button
            onClick={handleRaiseHand}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all ${
              handRaised
                ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
            }`}
          >
            <FiArrowUp className="w-4 h-4" />
            <span className="hidden sm:inline">{handRaised ? "Lower Hand" : "Raise Hand"}</span>
          </button>
        )}

        {/* Chat toggle */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 hover:border-white/30 text-gray-300 text-sm font-semibold transition-all"
          aria-label="Toggle chat"
        >
          <FiMessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Chat</span>
          {messages.length > 0 && (
            <span className="w-4 h-4 bg-[#EB83EA] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {messages.length > 9 ? "9+" : messages.length}
            </span>
          )}
        </button>

        {/* Leave / End */}
        <button
          onClick={handleLeave}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-sm font-semibold transition-all"
        >
          <FiLogOut className="w-4 h-4" />
          <span>{isHost ? "End Room" : "Leave"}</span>
        </button>
      </div>

      {/* Mute all - host only */}
      {isHost && joined && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => {
              sendData({ to: "*", payload: JSON.stringify({ type: "mute-all" }), label: "admin" });
              toast.success("Muted all participants");
            }}
            className="flex-1 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-semibold transition-all"
          >
            Mute All
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex-1 py-2.5 rounded-full border border-[#EB83EA]/30 bg-[#EB83EA]/10 hover:bg-[#EB83EA]/20 text-[#EB83EA] text-sm font-semibold transition-all"
          >
            Raised Hands
          </button>
        </div>
      )}
    </div>
  );
}

// Minimal listener avatar component
function ListenerAvatar({ peerId }: { peerId: string }) {
  const { metadata } = useRemotePeerMetadata(peerId);
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-gray-800">
      <Image
        src={metadata?.avatarUrl || "/defaultpfp.png"}
        alt={metadata?.displayName || "Listener"}
        width={36}
        height={36}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = "/defaultpfp.png"; }}
      />
    </div>
  );
}

function useRemotePeerMetadata(peerId: string) {
  const { metadata } = useRemotePeer<{ displayName?: string; avatarUrl?: string }>({ peerId });
  return { metadata };
}
