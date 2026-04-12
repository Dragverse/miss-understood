"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiRadio, FiUsers, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { CreateRoomForm } from "./create-room-form";
import { useRoomStore } from "@/lib/store/room";

interface LiveRoom {
  huddle_room_id: string;
  title: string;
  listener_count: number;
  profiles?: { handle: string; display_name: string; avatar: string } | null;
}

export function RoomsSidebar() {
  const { activeRoom } = useRoomStore();
  const router = useRouter();
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-close form once in a room
  useEffect(() => {
    if (activeRoom) setShowForm(false);
  }, [activeRoom]);

  async function fetchRooms() {
    try {
      const res = await fetch("/api/rooms/list");
      const data = await res.json();
      if (data.rooms) setLiveRooms(data.rooms);
    } catch {}
  }

  return (
    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiRadio className="w-4 h-4 text-[#EB83EA]" />
          <span className="text-white font-black text-sm uppercase tracking-widest">Vibe Lounge</span>
        </div>
        {liveRooms.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#EB83EA] text-white text-[9px] font-black">
            {liveRooms.length} LIVE
          </span>
        )}
      </div>

      {/* Active room state */}
      {activeRoom ? (
        <button
          onClick={() => router.push(`/rooms/${activeRoom.roomId}`)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#EB83EA]/20 border border-[#EB83EA]/40 hover:bg-[#EB83EA]/30 transition-all text-left"
        >
          <span className="w-2 h-2 bg-[#EB83EA] rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{activeRoom.title}</p>
            <p className="text-[#EB83EA] text-[10px]">You&apos;re live · tap to open</p>
          </div>
        </button>
      ) : (
        <>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#EB83EA]/20"
          >
            <FiRadio className="w-4 h-4" />
            Go Live
            {showForm ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showForm && (
            <CreateRoomForm onCreated={() => setShowForm(false)} />
          )}
        </>
      )}

      {/* Live rooms list */}
      {liveRooms.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold px-1">
            Live Now
          </span>
          {liveRooms.map((room) => {
            const hostName = room.profiles?.display_name || room.profiles?.handle || "Host";
            return (
              <button
                key={room.huddle_room_id}
                onClick={() => router.push(`/rooms/${room.huddle_room_id}`)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#EB83EA]/30 transition-all text-left"
              >
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold line-clamp-1">{room.title}</p>
                  <p className="text-gray-500 text-[10px]">
                    {hostName} · {room.listener_count} listening
                  </p>
                </div>
                <FiUsers className="w-3 h-3 text-gray-600 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {!activeRoom && liveRooms.length === 0 && !showForm && (
        <p className="text-gray-600 text-xs text-center py-1">No rooms live · be the first!</p>
      )}
    </div>
  );
}
