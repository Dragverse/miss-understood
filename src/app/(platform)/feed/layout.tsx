import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's Happening",
  description:
    "Follow drag artists, discover trending performances, and join the conversation on Dragverse. Real-time feed of videos, posts, and live streams.",
  openGraph: {
    title: "What's Happening | Dragverse",
    description:
      "Follow drag artists, discover trending performances, and join the conversation on Dragverse.",
    type: "website",
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
