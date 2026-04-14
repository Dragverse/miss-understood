import type { Metadata } from "next";
import { getVideo } from "@/lib/supabase/videos";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideo(id).catch(() => null);

  if (!video) {
    return {
      title: "Watch",
      description: "Watch drag performances and videos on Dragverse.",
    };
  }

  const title = video.title || "Drag Performance";
  const creatorName = (video as any).creator?.display_name || "a creator";
  const description =
    video.description?.slice(0, 155) ||
    `Watch "${title}" by ${creatorName} on Dragverse.`;
  const videoUrl = `${APP_URL}/watch/${id}`;
  const thumbnail =
    video.thumbnail ||
    `${APP_URL}/default-thumbnail.jpg`;

  return {
    title,
    description,
    alternates: { canonical: videoUrl },
    openGraph: {
      type: "video.other",
      title: `${title} | Dragverse`,
      description,
      url: videoUrl,
      images: [{ url: thumbnail, width: 1280, height: 720, alt: title }],
      siteName: "Dragverse",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Dragverse`,
      description,
      images: [thumbnail],
    },
  };
}

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
