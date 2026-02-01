import { FiExternalLink } from "react-icons/fi";

interface FarcasterBadgeProps {
  username: string;
  className?: string;
}

/**
 * Farcaster Badge Component
 * Subtle indicator showing Farcaster connection with tooltip
 */
export function FarcasterBadge({ username, className = "" }: FarcasterBadgeProps) {
  return (
    <a
      href={`https://warpcast.com/${username}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Connected to Farcaster"
      className={`inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition group ${className}`}
    >
      {/* Farcaster icon (simplified) */}
      <svg className="w-4 h-4" viewBox="0 0 1000 1000" fill="currentColor">
        <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
        <path d="M128.889 253.333L156.111 155.556H193.333V253.333H128.889Z" />
        <path d="M806.667 253.333L833.889 155.556H871.111V253.333H806.667Z" />
      </svg>
      <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
}

/**
 * Inline Farcaster Indicator
 * Small indicator showing data synced from Farcaster
 */
export function FarcasterIndicator({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-purple-400 ${className}`}>
      <svg className="w-3 h-3" viewBox="0 0 1000 1000" fill="currentColor">
        <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
        <path d="M128.889 253.333L156.111 155.556H193.333V253.333H128.889Z" />
        <path d="M806.667 253.333L833.889 155.556H871.111V253.333H806.667Z" />
      </svg>
      <span>from Farcaster</span>
    </span>
  );
}
