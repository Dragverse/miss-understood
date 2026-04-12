import React from "react";
import { OwnershipBanner } from "@/components/ui/ownership-banner";
import { PersistentAudioPlayer } from "@/components/audio/PersistentAudioPlayer";
import { VibeLounge } from "@/components/rooms/vibe-lounge";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <VibeLounge />
      <PersistentAudioPlayer />
      <OwnershipBanner />
    </>
  );
}
