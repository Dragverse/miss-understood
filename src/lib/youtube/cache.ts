/**
 * YouTube API Response Caching
 * Reduces API quota usage by caching results in-memory
 *
 * Benefits:
 * - Saves YouTube API quota (10,000 units/day limit)
 * - Faster response times
 * - Better dev experience (no quota anxiety)
 */

import type { Video } from "@/types";

interface CachedData {
  videos: Video[];
  timestamp: number;
  key: string;
}

// In-memory cache (resets on server restart)
const cache = new Map<string, CachedData>();

// Cache duration: 1 hour (3600 seconds)
const CACHE_DURATION_MS = 60 * 60 * 1000;

/**
 * Get cached YouTube videos or fetch fresh if expired
 */
export function getCachedVideos(key: string): Video[] | null {
  const cached = cache.get(key);

  if (!cached) {
    console.log(`[YouTube Cache] MISS: No cache for "${key}"`);
    return null;
  }

  const age = Date.now() - cached.timestamp;
  const ageMinutes = Math.floor(age / 1000 / 60);

  if (age > CACHE_DURATION_MS) {
    console.log(`[YouTube Cache] EXPIRED: "${key}" is ${ageMinutes} minutes old (max 60)`);
    cache.delete(key);
    return null;
  }

  console.log(`[YouTube Cache] HIT: "${key}" (age: ${ageMinutes}m, cached ${cached.videos.length} videos)`);
  return cached.videos;
}

/**
 * Save videos to cache
 */
export function setCachedVideos(key: string, videos: Video[]): void {
  cache.set(key, {
    videos,
    timestamp: Date.now(),
    key,
  });
  console.log(`[YouTube Cache] SAVED: "${key}" (${videos.length} videos, expires in 60 minutes)`);
}

/**
 * Clear all cached data (useful for testing)
 */
export function clearCache(): void {
  const size = cache.size;
  cache.clear();
  console.log(`[YouTube Cache] CLEARED: Removed ${size} cache entries`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(cache.values());
  const now = Date.now();

  return {
    totalEntries: entries.length,
    entries: entries.map(entry => ({
      key: entry.key,
      videoCount: entry.videos.length,
      ageMinutes: Math.floor((now - entry.timestamp) / 1000 / 60),
      expiresInMinutes: Math.floor((CACHE_DURATION_MS - (now - entry.timestamp)) / 1000 / 60),
    })),
  };
}
