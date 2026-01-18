"use client";

import { ReactNode } from "react";

interface GradientCardProps {
  children: ReactNode;
  mood?: string;
  gradient?: string;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

const MOOD_GRADIENTS: Record<string, string> = {
  sparkling: "from-purple-500/10 via-pink-500/10 to-yellow-500/10",
  soft: "from-pink-300/10 via-rose-300/10 to-purple-300/10",
  fierce: "from-red-500/10 via-orange-500/10 to-yellow-500/10",
  dramatic: "from-purple-900/10 via-black/10 to-purple-900/10",
  playful: "from-blue-400/10 via-pink-400/10 to-yellow-400/10",
  regal: "from-purple-700/10 via-gold/10 to-purple-700/10",
  slay: "from-fuchsia-500/10 via-pink-500/10 to-rose-500/10",
  magical: "from-indigo-500/10 via-purple-500/10 to-pink-500/10",
};

export function GradientCard({
  children,
  mood,
  gradient,
  className = "",
  hover = true,
  onClick,
}: GradientCardProps) {
  const bgGradient = gradient || (mood ? MOOD_GRADIENTS[mood] : null) || "from-[#18122D] to-[#1a0b2e]";

  const hoverStyles = hover
    ? "hover:border-[#EB83EA]/40 hover:shadow-xl hover:shadow-[#EB83EA]/20 hover:scale-[1.01]"
    : "";

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${bgGradient} rounded-3xl p-6 border-2 border-[#EB83EA]/10 transition-all shadow-lg ${hoverStyles} ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
