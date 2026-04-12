import { create } from "zustand";

interface StreamStore {
  showModal: boolean;
  openStreamModal: () => void;
  closeStreamModal: () => void;
}

export const useStreamStore = create<StreamStore>((set) => ({
  showModal: false,
  openStreamModal: () => set({ showModal: true }),
  closeStreamModal: () => set({ showModal: false }),
}));
