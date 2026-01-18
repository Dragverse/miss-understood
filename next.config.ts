import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "livepeercdn.studio",
      },
      {
        protocol: "https",
        hostname: "*.livepeer.studio",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.bsky.app",
      },
    ],
  },
  // Security headers (moved from deprecated middleware.ts)
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        // Allow Privy embedded wallet iframes
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=(), payment=()",
        },
        // Content Security Policy for Privy embedded wallets
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://*.privy.io",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "media-src 'self' blob: data: https://livepeercdn.studio https://*.livepeer.studio",
            "frame-src 'self' https://auth.privy.io https://*.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
            "connect-src 'self' https://auth.privy.io https://*.privy.io https://*.walletconnect.com https://*.walletconnect.org https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.walletconnect.org https://livepeercdn.studio https://livepeer.studio https://origin.livepeer.com https://storage.googleapis.com https://*.supabase.co wss://*.supabase.co",
            "worker-src 'self' blob:",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
