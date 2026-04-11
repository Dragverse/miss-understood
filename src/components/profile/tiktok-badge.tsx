import { FaTiktok } from "react-icons/fa";
import { FiExternalLink } from "react-icons/fi";

interface TikTokBadgeProps {
  handle: string;
  className?: string;
}

export function TikTokBadge({ handle, className = "" }: TikTokBadgeProps) {
  return (
    <a
      href={`https://tiktok.com/@${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`TikTok: @${handle}`}
      className={`inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 transition group ${className}`}
    >
      <FaTiktok className="w-4 h-4" />
      <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
}
