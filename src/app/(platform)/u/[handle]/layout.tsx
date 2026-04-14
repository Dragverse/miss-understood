import type { Metadata } from "next";
import { getCreatorByHandleOrDID } from "@/lib/supabase/creators";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const creator = await getCreatorByHandleOrDID(handle).catch(() => null);

  if (!creator) {
    return {
      title: `@${handle}`,
      description: `View ${handle}'s profile on Dragverse.`,
    };
  }

  const name = creator.display_name || creator.handle;
  const bio = creator.description
    ? creator.description.slice(0, 155)
    : `Watch ${name}'s drag performances, videos, and live streams on Dragverse.`;
  const profileUrl = `${APP_URL}/u/${creator.handle}`;
  const ogImage = creator.avatar
    ? [{ url: creator.avatar, width: 400, height: 400, alt: name }]
    : [{ url: `${APP_URL}/dragverse.jpg`, width: 1200, height: 630, alt: "Dragverse" }];

  return {
    title: name,
    description: bio,
    alternates: { canonical: profileUrl },
    openGraph: {
      type: "profile",
      title: `${name} | Dragverse`,
      description: bio,
      url: profileUrl,
      images: ogImage,
      siteName: "Dragverse",
    },
    twitter: {
      card: "summary",
      title: `${name} | Dragverse`,
      description: bio,
      images: ogImage.map((i) => i.url),
    },
  };
}

export default function CreatorProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
