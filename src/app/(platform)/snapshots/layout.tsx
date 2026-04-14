import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Snapshots",
  description:
    "Short-form drag content, quick looks, and performance clips from the Dragverse community.",
  openGraph: {
    title: "Drag Snapshots | Dragverse",
    description:
      "Short-form drag content, quick looks, and performance clips from the Dragverse community.",
    type: "website",
  },
};

export default function SnapshotsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
