"use client";

import { useRoomStore } from "@/lib/store/room";
import { useRoom, useLocalAudio } from "@huddle01/react/hooks";
import { FiMic, FiMicOff, FiLogOut, FiChevronUp } from "react-icons/fi";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

export function FloatingRoomBar() {
  const { activeRoom, clearActiveRoom, isMuted, setMuted } = useRoomStore();
  const { leaveRoom } = useRoom({
    onLeave: () => clearActiveRoom(),
  });
  const { enableAudio, disableAudio, isAudioOn } = useLocalAudio();
  const pathname = usePathname();
  const { getAccessToken } = usePrivy();

  // Don't show on the room page itself (full view is there)
  const isOnRoomPage = pathname?.startsWith("/rooms/");
  if (!activeRoom || isOnRoomPage) return null;

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

  const handleLeave = async () => {
    try {
      if (activeRoom.isHost) {
        await fetch("/api/rooms/end", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getAccessToken()}`,
          },
          body: JSON.stringify({ roomId: activeRoom.roomId }),
        });
      }
      await leaveRoom();
      clearActiveRoom();
    } catch {
      clearActiveRoom();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#18122D] via-[#1a0b2e] to-[#18122D] border-t-2 border-[#EB83EA]/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2 h-2 bg-[#4CAF50] rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest hidden sm:block">
            Live
          </span>
        </div>

        {/* Room info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate leading-tight">
            {activeRoom.title}
          </p>
          <p className="text-[#EB83EA] text-[10px] truncate uppercase tracking-wider">
            Live Listening · {activeRoom.hostName}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mute toggle */}
          <button
            onClick={handleMuteToggle}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isAudioOn
                ? "bg-[#EB83EA] hover:bg-[#E748E6] text-white"
                : "bg-white/10 hover:bg-white/20 text-gray-400"
            }`}
            aria-label={isAudioOn ? "Mute mic" : "Unmute mic"}
          >
            {isAudioOn ? <FiMic className="w-4 h-4" /> : <FiMicOff className="w-4 h-4" />}
          </button>

          {/* Expand to full room */}
          <Link
            href={`/rooms/${activeRoom.roomId}`}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            aria-label="Open room"
          >
            <FiChevronUp className="w-4 h-4 text-white" />
          </Link>

          {/* Leave */}
          <button
            onClick={handleLeave}
            className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-all"
            aria-label="Leave room"
          >
            <FiLogOut className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
