import type { Metadata, Viewport } from "next";
import { Parkinsans, Rammetto_One } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Layout } from "@/components/layout";

const rammettoOne = Rammetto_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rammetto",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#EB83EA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${rammettoOne.variable} ${parkinsans.variable} font-parkinsans antialiased`} suppressHydrationWarning>
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
