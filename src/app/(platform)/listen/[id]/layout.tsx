import type { Metadata } from "next";
import { getVideo } from "@/lib/supabase/videos";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const track = await getVideo(id).catch(() => null);

  if (!track) {
    return {
      title: "Listen",
      description: "Listen to drag performances and music on Dragverse.",
    };
  }

  const title = track.title || "Drag Audio";
  const creatorName = (track as any).creator?.display_name || "a creator";
  const description =
    track.description?.slice(0, 155) ||
    `Listen to "${title}" by ${creatorName} on Dragverse.`;
  const listenUrl = `${APP_URL}/listen/${id}`;

  return {
    title,
    description,
    alternates: { canonical: listenUrl },
    openGraph: {
      type: "music.song",
      title: `${title} | Dragverse`,
      description,
      url: listenUrl,
      siteName: "Dragverse",
      images: [{ url: `${APP_URL}/dragverse.jpg`, width: 1200, height: 630, alt: "Dragverse" }],
    },
    twitter: {
      card: "summary",
      title: `${title} | Dragverse`,
      description,
    },
  };
}

export default function ListenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
