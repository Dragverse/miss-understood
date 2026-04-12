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
  // Saved mic state before AudioPlayer auto-muted; null = no auto-mute in progress
  prePlayMuted: boolean | null;
  isPanelOpen: boolean;
  setActiveRoom: (room: ActiveRoom) => void;
  clearActiveRoom: () => void;
  setMuted: (muted: boolean) => void;
  setPrePlayMuted: (v: boolean | null) => void;
  openPanel: () => void;
  closePanel: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeRoom: null,
  isMuted: true,
  prePlayMuted: null,
  isPanelOpen: false,
  setActiveRoom: (room) => set({ activeRoom: room }),
  clearActiveRoom: () => set({ activeRoom: null, isMuted: true, prePlayMuted: null }),
  setMuted: (muted) => set({ isMuted: muted }),
  setPrePlayMuted: (v) => set({ prePlayMuted: v }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
}));
