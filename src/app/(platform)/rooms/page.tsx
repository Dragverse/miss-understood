"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useRoomStore } from "@/lib/store/room";
import { RoomCard } from "@/components/rooms/room-card";
import { CreateRoomForm } from "@/components/rooms/create-room-form";
import { FiRefreshCw, FiRadio } from "react-icons/fi";

interface Room {
  id: string;
  huddle_room_id: string;
  title: string;
  tags: string[];
  privacy: string;
  listener_count: number;
  created_at: string;
  profiles?: {
    handle: string;
    display_name: string;
    avatar: string;
  } | null;
}

export default function RoomsPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { setActiveRoom } = useRoomStore();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms/list");
      const data = await res.json();
      setRooms(data.rooms ?? []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30_000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleJoin = (roomId: string, title: string, hostName: string, hostAvatar: string) => {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    setActiveRoom({ roomId, title, hostName, hostAvatar, isHost: false });
    router.push(`/rooms/${roomId}`);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiRadio className="w-7 h-7 text-[#EB83EA]" />
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-black uppercase tracking-wide">
              <span className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Vibe Lounge
              </span>
            </h1>
            <p className="text-gray-400 text-sm">Live audio rooms · Join or start one</p>
          </div>
        </div>
        <button
          onClick={fetchRooms}
          disabled={loading}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition"
          aria-label="Refresh rooms"
        >
          <FiRefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create room form */}
        <div className="lg:col-span-4 xl:col-span-3">
          {authenticated ? (
            <CreateRoomForm />
          ) : (
            <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl p-5 text-center">
              <FiRadio className="w-10 h-10 text-[#EB83EA] mx-auto mb-3" />
              <p className="text-white font-bold mb-1">Start a Room</p>
              <p className="text-gray-400 text-sm mb-4">Sign in to host your own audio space</p>
              <button
                onClick={() => router.push("/login")}
                className="px-6 py-2.5 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-full text-white text-sm font-bold"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* Right: Active rooms */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-[#4CAF50] rounded-full animate-pulse" />
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">Active Now</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl p-4 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-12 bg-white/10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-2 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 mb-3">
                    <div className="h-5 bg-white/10 rounded-full w-12" />
                    <div className="h-5 bg-white/10 rounded-full w-16" />
                  </div>
                  <div className="h-7 bg-white/10 rounded-full" />
                </div>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
              <FiRadio className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No live rooms right now</p>
              <p className="text-gray-600 text-sm mt-1">Be the first to start one</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={handleJoin} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
