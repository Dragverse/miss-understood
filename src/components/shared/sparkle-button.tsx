"use client";

import { ReactNode, ButtonHTMLAttributes, useState } from "react";

interface SparkleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  sparkleOnHover?: boolean;
}

export function SparkleButton({
  children,
  sparkleOnHover = true,
  className = "",
  ...props
}: SparkleButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      className={`relative px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] rounded-full font-bold text-white transition-all shadow-lg shadow-[#EB83EA]/30 hover:shadow-xl hover:shadow-[#EB83EA]/40 hover:scale-[1.05] overflow-hidden group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Sparkle effect on hover */}
      {sparkleOnHover && isHovered && (
        <>
          <span className="absolute top-2 left-4 text-yellow-300 animate-ping opacity-75">✨</span>
          <span className="absolute bottom-2 right-6 text-yellow-300 animate-ping opacity-75 animation-delay-150">
            ✨
          </span>
          <span className="absolute top-1/2 right-4 text-yellow-300 animate-ping opacity-75 animation-delay-300">
            ✨
          </span>
        </>
      )}

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
