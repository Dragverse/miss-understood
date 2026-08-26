import { notFound } from "next/navigation";
import { VERTICAL_VIDEO_ENABLED } from "@/config/features";

/**
 * Gate for the vertical-video feed.
 *
 * Kept as a layout so page.tsx stays exactly as written — flipping
 * VERTICAL_VIDEO_ENABLED back to true restores the feed with no other edit.
 */
export default function SnapshotsLayout({ children }: { children: React.ReactNode }) {
  if (!VERTICAL_VIDEO_ENABLED) notFound();
  return <>{children}</>;
}
