"use client";

interface LoadingShimmerProps {
  className?: string;
  lines?: number;
  aspectRatio?: "square" | "video" | "wide";
}

export function LoadingShimmer({ className = "", lines, aspectRatio }: LoadingShimmerProps) {
  // Single shimmer block
  if (!lines) {
    const aspectClasses = {
      square: "aspect-square",
      video: "aspect-video",
      wide: "aspect-[21/9]",
    };

    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 rounded-2xl ${
          aspectRatio ? aspectClasses[aspectRatio] : ""
        } ${className}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>
    );
  }

  // Multiple shimmer lines (for text content)
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => {
        // Vary the width of each line for more realistic skeleton
        const widthClass =
          index === lines - 1 ? "w-3/4" : index % 3 === 0 ? "w-full" : index % 2 === 0 ? "w-5/6" : "w-11/12";

        return (
          <div
            key={index}
            className={`h-4 ${widthClass} relative overflow-hidden bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 rounded-lg`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          </div>
        );
      })}
    </div>
  );
}

// Card skeleton with shimmer
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <LoadingShimmer className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <LoadingShimmer className="h-4 w-32 mb-2" />
          <LoadingShimmer className="h-3 w-24" />
        </div>
      </div>

      {/* Content */}
      <LoadingShimmer lines={3} className="mb-4" />

      {/* Media */}
      <LoadingShimmer aspectRatio="video" className="mb-4" />

      {/* Actions */}
      <div className="flex gap-4">
        <LoadingShimmer className="h-10 w-24 rounded-full" />
        <LoadingShimmer className="h-10 w-24 rounded-full" />
        <LoadingShimmer className="h-10 w-24 rounded-full" />
      </div>
    </div>
  );
}
