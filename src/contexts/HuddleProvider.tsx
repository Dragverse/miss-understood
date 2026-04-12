"use client";

import { HuddleClient, HuddleProvider as HuddleSDKProvider } from "@huddle01/react";

const huddleClient = new HuddleClient({
  projectId: process.env.NEXT_PUBLIC_HUDDLE01_PROJECT_ID || "",
  options: {
    activeSpeakers: { size: 8 },
  },
});

export function HuddleProvider({ children }: { children: React.ReactNode }) {
  return (
    <HuddleSDKProvider client={huddleClient}>
      {children}
    </HuddleSDKProvider>
  );
}
