import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Videos",
  description:
    "Watch the latest drag performances, tutorials, and behind-the-scenes content from creators on Dragverse.",
  openGraph: {
    title: "Drag Videos | Dragverse",
    description:
      "Watch the latest drag performances, tutorials, and behind-the-scenes content from creators on Dragverse.",
    type: "website",
  },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
