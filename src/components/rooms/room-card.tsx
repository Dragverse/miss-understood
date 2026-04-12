"use client";

import Image from "next/image";
import { FiUsers } from "react-icons/fi";

interface RoomCardProps {
  room: {
    huddle_room_id: string;
    title: string;
    tags: string[];
    listener_count: number;
    profiles?: {
      handle: string;
      display_name: string;
      avatar: string;
    } | null;
  };
  onJoin: (roomId: string, title: string, hostName: string, hostAvatar: string) => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const host = room.profiles;
  const hostName = host?.display_name || host?.handle || "Host";
  const hostAvatar = host?.avatar || "/defaultpfp.png";

  return (
    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl p-4 hover:border-[#EB83EA]/40 transition-all group">
      <div className="flex items-start gap-3 mb-3">
        {/* Host avatar */}
        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#EB83EA]/30 flex-shrink-0">
          <Image src={hostAvatar} alt={hostName} fill className="object-cover" />
          {/* Live dot */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4CAF50] border-2 border-[#1a0b2e] rounded-full" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-[#EB83EA] transition-colors">
            {room.title}
          </h3>
          <p className="text-gray-400 text-xs mt-0.5 truncate">
            BY {hostName.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Tags */}
      {room.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {room.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-gray-300 uppercase tracking-wide"
            >
              {tag.replace(/^#/, "")}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <FiUsers className="w-3.5 h-3.5" />
          <span>{room.listener_count}</span>
        </div>
        <button
          onClick={() => onJoin(room.huddle_room_id, room.title, hostName, hostAvatar)}
          className="px-4 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 bg-white/10 hover:bg-[#EB83EA] border border-white/10 hover:border-[#EB83EA] rounded-full text-xs font-bold transition-all text-white flex items-center"
        >
          JOIN
        </button>
      </div>
    </div>
  );
}
