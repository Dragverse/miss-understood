import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description:
    "Celebrating the icons and legends of the Dragverse community. Meet the most celebrated drag performers and creators.",
  openGraph: {
    title: "Drag Hall of Fame | Dragverse",
    description:
      "Celebrating the icons and legends of the Dragverse community. Meet the most celebrated drag performers.",
    type: "website",
  },
};

export default function HallOfFameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
