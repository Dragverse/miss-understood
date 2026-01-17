import { Video, Creator } from "@/types";

/**
 * LocalStorage utilities for fallback mode when Ceramic is unavailable
 */

export function getLocalVideos(): Video[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("dragverse_videos");
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load local videos:", error);
    return [];
  }
}

export function saveLocalVideo(video: Video) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalVideos();
    existing.unshift(video);
    localStorage.setItem("dragverse_videos", JSON.stringify(existing));
  } catch (error) {
    console.error("Failed to save local video:", error);
  }
}

export function getLocalProfile(): Partial<Creator> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("dragverse_profile");
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Failed to load local profile:", error);
    return null;
  }
}

export function saveLocalProfile(profile: Partial<Creator>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("dragverse_profile", JSON.stringify(profile));
  } catch (error) {
    console.error("Failed to save local profile:", error);
  }
}

export function clearLocalData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("dragverse_videos");
  localStorage.removeItem("dragverse_profile");
}
