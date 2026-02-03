import type { Metadata } from "next";
import { Parkinsans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Layout } from "@/components/layout";

const donutHole = localFont({
  src: "../../public/fonts/DonutHole.otf",
  variable: "--font-donut-hole",
  display: "swap",
});

const parkinsans = Parkinsans({
  subsets: ["latin"],
  variable: "--font-parkinsans",
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
  themeColor: "#EB83EA",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${donutHole.variable} ${parkinsans.variable} font-parkinsans antialiased`}>
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
