import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Now",
  description:
    "Watch drag artists live on Dragverse. Real-time performances, Q&As, makeup tutorials, and more streaming now.",
  openGraph: {
    title: "Live Drag Streams | Dragverse",
    description:
      "Watch drag artists live. Real-time performances, Q&As, makeup tutorials, and more streaming now.",
    type: "website",
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
