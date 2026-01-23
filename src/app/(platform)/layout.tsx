import React from "react";
import { OwnershipBanner } from "@/components/ui/ownership-banner";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { PersistentAudioPlayer } from "@/components/audio/PersistentAudioPlayer";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioPlayerProvider>
      {children}
      <PersistentAudioPlayer />
      <OwnershipBanner />
    </AudioPlayerProvider>
  );
}
