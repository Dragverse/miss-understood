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
    <div className="fixed bottom-20 right-4 z-[60] w-72 bg-[#1a0b2e] border border-[#EB83EA]/40 rounded-2xl shadow-2xl shadow-[#EB83EA]/10 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Room info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full animate-pulse" />
            <span className="text-[#4CAF50] text-[9px] font-black uppercase tracking-widest">Live</span>
          </div>
          <p className="text-white font-bold text-xs truncate leading-tight">{activeRoom.title}</p>
          <p className="text-[#EB83EA] text-[10px] truncate">{activeRoom.hostName}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleMuteToggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isAudioOn ? "bg-[#EB83EA] text-white" : "bg-white/10 text-gray-400"
            }`}
            aria-label={isAudioOn ? "Mute mic" : "Unmute mic"}
          >
            {isAudioOn ? <FiMic className="w-3.5 h-3.5" /> : <FiMicOff className="w-3.5 h-3.5" />}
          </button>
          <Link
            href={`/rooms/${activeRoom.roomId}`}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            aria-label="Open room"
          >
            <FiChevronUp className="w-3.5 h-3.5 text-white" />
          </Link>
          <button
            onClick={handleLeave}
            className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-all"
            aria-label="Leave room"
          >
            <FiLogOut className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
