/**
 * Skeleton loader for video cards
 * Shows while videos are loading for better UX
 */

export function VideoCardSkeleton() {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-[#1a0b2e]/40 border border-white/5 animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="relative aspect-video bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Avatar + Info */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#EB83EA]/20" />

          {/* Text content */}
          <div className="flex-1 space-y-2">
            {/* Title */}
            <div className="h-4 bg-white/10 rounded-md w-3/4" />
            {/* Creator name */}
            <div className="h-3 bg-white/5 rounded-md w-1/2" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="h-3 bg-white/5 rounded-md w-16" />
          <div className="h-3 bg-white/5 rounded-md w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Grid of skeleton loaders
 */
export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Short video skeleton loader
 */
export function ShortVideoSkeleton() {
  return (
    <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#1a0b2e]/40 border border-white/5 animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

/**
 * Shorts section skeleton
 */
export function ShortsSectionSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-white/10 rounded-md w-32 animate-pulse" />
      </div>

      {/* Shorts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShortVideoSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
