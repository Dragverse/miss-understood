import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tech & Ethics",
  description:
    "Dragverse's commitment to ethical technology, data privacy, and responsible AI in service of the LGBTQ+ community.",
  openGraph: {
    title: "Tech & Ethics | Dragverse",
    description:
      "Dragverse's commitment to ethical technology, data privacy, and responsible AI in service of the LGBTQ+ community.",
    type: "website",
  },
};

export default function TechEthicsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
