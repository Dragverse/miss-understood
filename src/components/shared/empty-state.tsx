"use client";

import { ReactNode } from "react";
import { ActionButton } from "./action-button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  gradient?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  gradient = "from-[#EB83EA]/20 to-[#7c3aed]/20",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Icon with gradient background */}
      <div
        className={`w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br ${gradient} flex items-center justify-center text-5xl shadow-xl shadow-[#EB83EA]/10`}
      >
        {icon}
      </div>

      {/* Title */}
      <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
        {title}
      </h2>

      {/* Description */}
      <p className="text-gray-400 text-lg mb-2 max-w-md">{description}</p>

      {/* Action button */}
      {actionLabel && onAction && (
        <div className="mt-6">
          <ActionButton onClick={onAction} size="lg">
            {actionLabel}
          </ActionButton>
        </div>
      )}

      {/* Decorative sparkles */}
      <div className="relative mt-8">
        <span className="text-yellow-300/30 text-2xl animate-pulse">✨</span>
        <span className="text-yellow-300/20 text-xl animate-pulse animation-delay-200 ml-4">✨</span>
        <span className="text-yellow-300/30 text-2xl animate-pulse animation-delay-400 ml-4">✨</span>
      </div>
    </div>
  );
}
