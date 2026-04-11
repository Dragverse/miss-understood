import { FiGlobe, FiExternalLink } from "react-icons/fi";

interface WebsiteBadgeProps {
  url: string;
  className?: string;
}

export function WebsiteBadge({ url, className = "" }: WebsiteBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`inline-flex items-center gap-1 text-gray-400 hover:text-gray-300 transition group ${className}`}
    >
      <FiGlobe className="w-4 h-4" />
      <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
}
