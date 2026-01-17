import { SiBluesky } from "react-icons/si";
import { FiExternalLink } from "react-icons/fi";

interface BlueskyBadgeProps {
  handle: string;
  className?: string;
}

/**
 * Bluesky Badge Component
 * Subtle indicator showing Bluesky connection with tooltip
 */
export function BlueskyBadge({ handle, className = "" }: BlueskyBadgeProps) {
  return (
    <a
      href={`https://bsky.app/profile/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Connected to Bluesky"
      className={`inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition group ${className}`}
    >
      <SiBluesky className="w-4 h-4" />
      <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
}

/**
 * Inline Bluesky Indicator
 * Small indicator showing data synced from Bluesky
 */
export function BlueskyIndicator({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-blue-400 ${className}`}>
      <SiBluesky className="w-3 h-3" />
      <span>from Bluesky</span>
    </span>
  );
}
