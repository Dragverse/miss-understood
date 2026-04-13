import { create } from "zustand";

interface LiveCreatorsStore {
  liveSet: Set<string>;
  setLive: (dids: string[]) => void;
  markLive: (did: string) => void;
  markOffline: (did: string) => void;
  isLive: (did: string | undefined | null) => boolean;
}

export const useLiveCreatorsStore = create<LiveCreatorsStore>((set, get) => ({
  liveSet: new Set(),
  setLive: (dids) => set({ liveSet: new Set(dids) }),
  markLive: (did) =>
    set((s) => ({ liveSet: new Set([...s.liveSet, did]) })),
  markOffline: (did) =>
    set((s) => {
      const next = new Set(s.liveSet);
      next.delete(did);
      return { liveSet: next };
    }),
  isLive: (did) => {
    if (!did) return false;
    return get().liveSet.has(did);
  },
}));
