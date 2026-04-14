import type { MetadataRoute } from "next";
import { getAllCreators } from "@/lib/supabase/creators";
import { getVideos } from "@/lib/supabase/videos";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${APP_URL}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/live`, lastModified: now, changeFrequency: "always", priority: 0.9 },
    { url: `${APP_URL}/creators`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${APP_URL}/videos`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${APP_URL}/audio`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${APP_URL}/snapshots`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${APP_URL}/hall-of-fame`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${APP_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/tech-ethics`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Creator profile pages
  const creators = await getAllCreators(200).catch(() => []);
  const creatorRoutes: MetadataRoute.Sitemap = creators
    .filter((c) => c.handle)
    .map((c) => ({
      url: `${APP_URL}/u/${c.handle}`,
      lastModified: c.updated_at || c.created_at || now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Video and audio content pages
  const videos = await getVideos(500).catch(() => []);
  const contentRoutes: MetadataRoute.Sitemap = videos.map((v) => {
    const isAudio = v.content_type === "podcast" || v.content_type === "music";
    return {
      url: `${APP_URL}/${isAudio ? "listen" : "watch"}/${v.id}`,
      lastModified: v.updated_at || v.created_at || now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    };
  });

  return [...staticRoutes, ...creatorRoutes, ...contentRoutes];
}
