"use client";

import { useState } from "react";
import { FiHeart } from "react-icons/fi";

interface HeartAnimationProps {
  initialLiked?: boolean;
  onToggle?: (liked: boolean) => void;
  size?: number;
  showCount?: boolean;
  count?: number;
}

export function HeartAnimation({
  initialLiked = false,
  onToggle,
  size = 20,
  showCount = false,
  count = 0,
}: HeartAnimationProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [isAnimating, setIsAnimating] = useState(false);
  const [localCount, setLocalCount] = useState(count);

  const handleClick = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setIsAnimating(true);
    setLocalCount(newLiked ? localCount + 1 : localCount - 1);

    setTimeout(() => setIsAnimating(false), 600);

    if (onToggle) {
      onToggle(newLiked);
    }
  };

  return (
    <button onClick={handleClick} className="flex items-center gap-2 group relative">
      {/* Heart burst animation */}
      {isAnimating && liked && (
        <>
          <FiHeart className="absolute inset-0 text-[#EB83EA] animate-ping opacity-75 w-full h-full" />
        </>
      )}

      {/* Heart icon */}
      <div
        className={`p-2 rounded-full transition-all ${
          liked
            ? "bg-[#EB83EA] text-white scale-110"
            : "hover:bg-[#EB83EA]/20 text-gray-400 group-hover:text-[#EB83EA]"
        } ${isAnimating ? "animate-bounce" : ""}`}
      >
        <FiHeart className={liked ? "fill-current" : ""} size={size} />
      </div>

      {/* Count */}
      {showCount && (
        <span
          className={`font-semibold transition-all ${
            liked ? "text-[#EB83EA] scale-110" : "text-gray-400 group-hover:text-white"
          }`}
        >
          {localCount}
        </span>
      )}
    </button>
  );
}
