import { NextResponse } from "next/server";
import { getCacheStats, clearCache } from "@/lib/youtube/cache";

/**
 * GET /api/youtube/cache-stats
 * View YouTube API cache statistics (development only)
 *
 * Query params:
 * - clear: "true" to clear the cache
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldClear = searchParams.get("clear") === "true";

  if (shouldClear) {
    clearCache();
    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully",
      stats: getCacheStats(),
    });
  }

  const stats = getCacheStats();

  return NextResponse.json({
    success: true,
    stats,
    message: `Cache has ${stats.totalEntries} entries. Use ?clear=true to clear.`,
  });
}
