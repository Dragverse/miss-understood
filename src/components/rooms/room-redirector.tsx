"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoomStore } from "@/lib/store/room";

export function RoomRedirector({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { setActiveRoom, openPanel } = useRoomStore();

  useEffect(() => {
    // Validate roomId format before trusting it
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) {
      router.replace("/rooms");
      return;
    }
    setActiveRoom({
      roomId,
      title: "Audio Room",
      hostName: "Host",
      hostAvatar: "/defaultpfp.png",
      isHost: false,
    });
    openPanel();
    router.replace("/rooms");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
