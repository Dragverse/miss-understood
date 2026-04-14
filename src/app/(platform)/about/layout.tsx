import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Dragverse — the decentralized creator platform built for drag artists and the LGBTQ+ community.",
  openGraph: {
    title: "About Dragverse",
    description:
      "Learn about Dragverse — the decentralized creator platform built for drag artists and the LGBTQ+ community.",
    type: "website",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
