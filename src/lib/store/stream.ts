import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActiveStreamInfo {
  id: string;
  livepeerStreamId?: string;
  streamKey: string;
  playbackId: string;
  playbackUrl: string;
  rtmpIngestUrl: string;
  title: string;
  creatorDID: string;
  method?: "browser" | "obs";
}

interface StreamStore {
  showModal: boolean;
  openStreamModal: () => void;
  closeStreamModal: () => void;
  activeStream: ActiveStreamInfo | null;
  setActiveStream: (s: ActiveStreamInfo) => void;
  clearActiveStream: () => void;
}

export const useStreamStore = create<StreamStore>()(
  persist(
    (set) => ({
      showModal: false,
      openStreamModal: () => set({ showModal: true }),
      closeStreamModal: () => set({ showModal: false }),
      activeStream: null,
      setActiveStream: (s) => set({ activeStream: s }),
      clearActiveStream: () => set({ activeStream: null }),
    }),
    {
      name: "dragverse-active-stream",
      // Only persist activeStream — don't persist modal open state
      partialize: (state) => ({ activeStream: state.activeStream }),
    }
  )
);
