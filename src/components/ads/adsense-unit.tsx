"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdSenseUnitProps {
  slot?: string;
  format?: string;
  className?: string;
}

export function AdSenseUnit({ slot, format = "auto", className }: AdSenseUnitProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet or ad blocker active
    }
  }, []);

  return (
    <div className={`rounded-[24px] overflow-hidden border-2 border-[#2f2942]/60 bg-[#0f071a] min-h-[250px] flex items-center justify-center ${className || ""}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4065288364118576"
        data-ad-format={format}
        data-full-width-responsive="true"
        {...(slot ? { "data-ad-slot": slot } : {})}
      />
    </div>
  );
}
