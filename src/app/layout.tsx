import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Roboto_Flex, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Layout } from "@/components/layout";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dragverse.app";
const OG_IMAGE = `${APP_URL}/dragverse.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Dragverse — Creator Platform for Drag Artists",
    template: "%s | Dragverse",
  },
  description:
    "Stream, share, and discover amazing drag performances. Upload videos, shorts, audio, and music on the decentralized creator platform built for drag artists worldwide.",
  keywords: [
    "drag queen",
    "drag king",
    "drag performer",
    "livestream",
    "drag videos",
    "LGBTQ creator",
    "drag community",
    "drag makeup",
    "ballroom",
    "voguing",
    "queer art",
  ],
  authors: [{ name: "Dragverse" }],
  creator: "Dragverse",
  publisher: "Dragverse",
  manifest: "/manifest.json",
  icons: {
    icon: "/dragverse-app-icon.jpg",
    apple: "/dragverse-app-icon.jpg",
    shortcut: "/dragverse-app-icon.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dragverse",
  },
  openGraph: {
    type: "website",
    siteName: "Dragverse",
    title: "Dragverse — Creator Platform for Drag Artists",
    description:
      "Stream, share, and discover amazing drag performances. Upload videos, shorts, audio, and music.",
    url: APP_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Dragverse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dragverse — Creator Platform for Drag Artists",
    description:
      "Stream, share, and discover amazing drag performances. Upload videos, shorts, audio, and music.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Removed maximumScale and userScalable restrictions for accessibility
  // Users should be able to zoom for better readability (WCAG 2.1 Level AA)
  themeColor: "#EB83EA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${robotoFlex.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4065288364118576"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
