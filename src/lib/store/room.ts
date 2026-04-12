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
  isPanelOpen: boolean;
  setActiveRoom: (room: ActiveRoom) => void;
  clearActiveRoom: () => void;
  setMuted: (muted: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeRoom: null,
  isMuted: true,
  isPanelOpen: false,
  setActiveRoom: (room) => set({ activeRoom: room }),
  clearActiveRoom: () => set({ activeRoom: null, isMuted: true }),
  setMuted: (muted) => set({ isMuted: muted }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
}));
