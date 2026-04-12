import { create } from "zustand";
import type { UploadAsset } from "@/types";

export type UploadStage = "idle" | "uploading" | "processing" | "saving" | "complete" | "error";

interface UploadProgressState {
  stage: UploadStage;
  progress: number;
  processingProgress: number;
  uploadedBytes: number;
  totalBytes: number;
  uploadSpeed: string;
  timeRemaining: string;
  fileName: string;
  error: string | null;
  startSession: (fileName: string) => void;
  setStage: (stage: UploadStage) => void;
  setProgress: (progress: number, loaded: number, total: number) => void;
  setProcessingProgress: (p: number) => void;
  setSpeed: (speed: string, remaining: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const idle = {
  stage: "idle" as UploadStage,
  progress: 0,
  processingProgress: 0,
  uploadedBytes: 0,
  totalBytes: 0,
  uploadSpeed: "",
  timeRemaining: "",
  fileName: "",
  error: null,
};

export const useUploadProgress = create<UploadProgressState>((set) => ({
  ...idle,
  startSession: (fileName) => set({ ...idle, stage: "uploading", fileName }),
  setStage: (stage) => set({ stage }),
  setProgress: (progress, uploadedBytes, totalBytes) => set({ progress, uploadedBytes, totalBytes }),
  setSpeed: (uploadSpeed, timeRemaining) => set({ uploadSpeed, timeRemaining }),
  setProcessingProgress: (processingProgress) => set({ processingProgress }),
  setError: (error) => set({ stage: "error", error }),
  reset: () => set(idle),
}));

interface UploadState {
  currentUpload: UploadAsset | null;
  uploads: UploadAsset[];
  addUpload: (upload: UploadAsset) => void;
  updateUpload: (id: string, update: Partial<UploadAsset>) => void;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
}

export const useUpload = create<UploadState>((set) => ({
  currentUpload: null,
  uploads: [],
  addUpload: (upload) =>
    set((state) => ({
      uploads: [...state.uploads, upload],
      currentUpload: upload,
    })),
  updateUpload: (id, update) =>
    set((state) => ({
      uploads: state.uploads.map((u) =>
        u.id === id ? { ...u, ...update } : u
      ),
      currentUpload:
        state.currentUpload?.id === id
          ? { ...state.currentUpload, ...update }
          : state.currentUpload,
    })),
  removeUpload: (id) =>
    set((state) => ({
      uploads: state.uploads.filter((u) => u.id !== id),
    })),
  clearUploads: () => set({ uploads: [], currentUpload: null }),
}));
