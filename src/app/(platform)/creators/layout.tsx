import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Creators",
  description:
    "Browse and discover drag queens, drag kings, and queer performers on Dragverse. Find your new favourite artists and follow their journey.",
  openGraph: {
    title: "Discover Drag Creators | Dragverse",
    description:
      "Browse drag queens, drag kings, and queer performers. Find your new favourite artists and follow their journey.",
    type: "website",
  },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
