import { SiBluesky } from "react-icons/si";
import { FiCheck, FiExternalLink } from "react-icons/fi";

interface BlueskyBadgeProps {
  handle: string;
  verified?: boolean;
  className?: string;
}

/**
 * Bluesky Badge Component
 * Shows a prominent badge indicating profile data comes from Bluesky
 * Links directly to the Bluesky profile
 */
export function BlueskyBadge({ handle, verified, className = "" }: BlueskyBadgeProps) {
  return (
    <a
      href={`https://bsky.app/profile/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full hover:bg-blue-500/20 transition group ${className}`}
    >
      <SiBluesky className="w-4 h-4 text-blue-400" />
      <span className="text-sm text-blue-400 font-medium">View on Bluesky</span>
      {verified && <FiCheck className="w-4 h-4 text-blue-400" />}
      <FiExternalLink className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition" />
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
