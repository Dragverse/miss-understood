import { create } from "zustand";

interface LiveCreatorsStore {
  liveSet: Set<string>;
  setLive: (dids: string[]) => void;
  isLive: (did: string | undefined | null) => boolean;
}

export const useLiveCreatorsStore = create<LiveCreatorsStore>((set, get) => ({
  liveSet: new Set(),
  setLive: (dids) => set({ liveSet: new Set(dids) }),
  isLive: (did) => {
    if (!did) return false;
    return get().liveSet.has(did);
  },
}));
