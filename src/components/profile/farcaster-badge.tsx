import Image from "next/image";
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
      {/* Farcaster icon */}
      <Image
        src="/farcaster-transparent-white.svg"
        alt="Farcaster"
        width={16}
        height={16}
        className="w-4 h-4"
      />
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
      <Image
        src="/farcaster-transparent-white.svg"
        alt="Farcaster"
        width={12}
        height={12}
        className="w-3 h-3"
      />
      <span>from Farcaster</span>
    </span>
  );
}

/**
 * Farcaster Icon Component
 * Reusable Farcaster icon for use throughout the app
 */
export function FarcasterIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <Image
      src="/farcaster-transparent-white.svg"
      alt="Farcaster"
      width={20}
      height={20}
      className={className}
    />
  );
}
