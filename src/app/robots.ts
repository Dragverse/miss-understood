import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/feed",
          "/live",
          "/creators",
          "/videos",
          "/audio",
          "/snapshots",
          "/hall-of-fame",
          "/about",
          "/tech-ethics",
          "/u/",
          "/watch/",
          "/listen/",
        ],
        disallow: [
          "/dashboard",
          "/settings",
          "/messages",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
