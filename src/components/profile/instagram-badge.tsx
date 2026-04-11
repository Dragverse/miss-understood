import { FaInstagram } from "react-icons/fa";
import { FiExternalLink } from "react-icons/fi";

interface InstagramBadgeProps {
  handle: string;
  className?: string;
}

export function InstagramBadge({ handle, className = "" }: InstagramBadgeProps) {
  return (
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Instagram: @${handle}`}
      className={`inline-flex items-center gap-1 text-pink-400 hover:text-pink-300 transition group ${className}`}
    >
      <FaInstagram className="w-4 h-4" />
      <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
}
