"use client";

interface MoodBadgeProps {
  mood: string;
  emoji?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const MOOD_EMOJIS: Record<string, string> = {
  sparkling: "✨",
  soft: "💖",
  fierce: "🔥",
  dramatic: "🎭",
  playful: "🌈",
  regal: "👑",
  slay: "💅",
  magical: "🦄",
};

export function MoodBadge({ mood, emoji, size = "md", onClick }: MoodBadgeProps) {
  const displayEmoji = emoji || MOOD_EMOJIS[mood.toLowerCase()] || "✨";

  const sizeStyles = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2",
  };

  const emojiSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${sizeStyles[size]} bg-[#EB83EA]/10 rounded-full border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 transition-all ${
        onClick ? "cursor-pointer hover:bg-[#EB83EA]/20" : ""
      }`}
    >
      <span className={emojiSizes[size]}>{displayEmoji}</span>
      <span className="text-[#EB83EA] font-semibold capitalize">{mood}</span>
    </div>
  );
}
