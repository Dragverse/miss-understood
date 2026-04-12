import { create } from "zustand";

interface StreamStore {
  showModal: boolean;
  openStreamModal: () => void;
  closeStreamModal: () => void;
  activeStream: { creatorDID: string; playbackId: string } | null;
  setActiveStream: (s: { creatorDID: string; playbackId: string }) => void;
  clearActiveStream: () => void;
}

export const useStreamStore = create<StreamStore>((set) => ({
  showModal: false,
  openStreamModal: () => set({ showModal: true }),
  closeStreamModal: () => set({ showModal: false }),
  activeStream: null,
  setActiveStream: (s) => set({ activeStream: s }),
  clearActiveStream: () => set({ activeStream: null }),
}));
