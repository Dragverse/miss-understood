import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "Dragverse - Creator Platform",
  description:
    "Stream, share, and discover amazing drag content. Upload shorts, long videos, podcasts, and music.",
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
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
