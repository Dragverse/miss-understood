import { create } from "zustand";

export interface ActiveRoom {
  roomId: string;        // Huddle01 room ID
  title: string;
  hostName: string;
  hostAvatar: string;
  isHost: boolean;
}

interface RoomState {
  activeRoom: ActiveRoom | null;
  isMuted: boolean;
  setActiveRoom: (room: ActiveRoom) => void;
  clearActiveRoom: () => void;
  setMuted: (muted: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeRoom: null,
  isMuted: true,
  setActiveRoom: (room) => set({ activeRoom: room }),
  clearActiveRoom: () => set({ activeRoom: null, isMuted: true }),
  setMuted: (muted) => set({ isMuted: muted }),
}));
