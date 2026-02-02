"use client";

import { FiHeart, FiActivity, FiFilm, FiSmile, FiAward, FiStar } from "react-icons/fi";

interface MoodBadgeProps {
  mood: string;
  emoji?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const MOOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkling: FiStar,
  soft: FiHeart,
  fierce: FiActivity,
  dramatic: FiFilm,
  playful: FiSmile,
  regal: FiAward,
  slay: FiStar,
  magical: FiSmile,
};

export function MoodBadge({ mood, emoji, size = "md", onClick }: MoodBadgeProps) {
  const MoodIcon = MOOD_ICONS[mood.toLowerCase()] || FiStar;

  const sizeStyles = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${sizeStyles[size]} bg-[#EB83EA]/10 rounded-full border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 transition-all ${
        onClick ? "cursor-pointer hover:bg-[#EB83EA]/20" : ""
      }`}
    >
      <MoodIcon className={`${iconSizes[size]} text-[#EB83EA]`} />
      <span className="text-[#EB83EA] font-semibold capitalize">{mood}</span>
    </div>
  );
}
