import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio",
  description:
    "Listen to drag performances, podcasts, original music, and remixes from queer artists on Dragverse.",
  openGraph: {
    title: "Drag Audio & Music | Dragverse",
    description:
      "Listen to drag performances, podcasts, original music, and remixes from queer artists.",
    type: "website",
  },
};

export default function AudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
