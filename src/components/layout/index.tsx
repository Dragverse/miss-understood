"use client";

import React, { useEffect } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { PersistentAudioPlayer } from "@/components/audio/PersistentAudioPlayer";
import { StreamModal } from "@/components/dashboard/stream-modal";
import { useStreamStore } from "@/lib/store/stream";
import { useCanLivestream } from "@/lib/livestream";
import { useLiveCreatorsStore } from "@/lib/store/live-creators";

function GlobalStreamModal() {
  const { showModal, closeStreamModal } = useStreamStore();
  const { canStream } = useCanLivestream();

  if (!showModal || !canStream) return null;
  return <StreamModal onClose={closeStreamModal} />;
}

/** Polls /api/stream/live-creators every 30s and keeps the store in sync */
function LiveCreatorsPoller() {
  const setLive = useLiveCreatorsStore((s) => s.setLive);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stream/live-creators");
        if (!res.ok) return;
        const { dids } = await res.json();
        setLive(dids ?? []);
      } catch {
        // silent
      }
    };

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [setLive]);

  return null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f071a] text-white flex flex-col">
      <Navbar />
      <Sidebar />
      <main className="pt-16 pb-20 md:pb-0 md:ml-20 flex-1">{children}</main>
      <div className="md:ml-20">
        <Footer />
      </div>
      <PersistentAudioPlayer />
      <GlobalStreamModal />
      <LiveCreatorsPoller />
    </div>
  );
}
