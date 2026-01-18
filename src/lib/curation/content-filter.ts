/**
 * Content Filtering System
 *
 * Filters content based on safety, appropriateness, and user preferences.
 * Addresses concerns about mature content and inappropriate material.
 */

import { Video } from "@/types";

export interface ContentFilter {
  safeMode: boolean;           // Filter mature/NSFW content
  contentTypes: string[];      // ["short", "long", "podcast", "photo"]
  categories: string[];        // ["Performance", "Tutorial", "Comedy", etc.]
  platforms: string[];         // ["dragverse", "bluesky", "youtube"]
  minQualityScore?: number;    // Minimum quality score (0-100)
  excludeCreators?: string[];  // Blocked creator DIDs/handles
  includeOnly?: "following" | "all"; // Show only followed creators
}

export interface ContentFlags {
  isMature: boolean;          // Contains mature content
  hasContentWarning: boolean; // Has content warning
  isSafe: boolean;            // Safe for all audiences
  reason?: string;            // Why it was flagged
}

// Mature content keywords (for title/description filtering)
const MATURE_KEYWORDS = [
  // Explicit terms
  "nude", "nudity", "naked", "nsfw", "18+", "adult only", "explicit",
  // Sexual content
  "sex", "sexual", "porn", "xxx", "erotic", "adult content",
  // Suggestive
  "thirst trap", "onlyfans", "spicy content",
];

// Safe content indicators (override mature detection)
const SAFE_INDICATORS = [
  "family friendly", "all ages", "g rated", "pg rated",
  "tutorial", "educational", "documentary", "interview",
  "behind the scenes", "makeup tutorial", "sewing tutorial",
];

// YouTube content rating mapping
const YOUTUBE_MATURE_CATEGORIES = [
  "mature", "restricted", "age restricted",
];

/**
 * Detect if content contains mature/NSFW material
 */
export function detectMatureContent(content: Video | any): ContentFlags {
  const title = (content.title || "").toLowerCase();
  const description = (content.description || "").toLowerCase();
  const tags = (content.tags || []).map((t: string) => t.toLowerCase());
  const combinedText = `${title} ${description} ${tags.join(" ")}`;

  let isMature = false;
  let reason = "";

  // Check for safe indicators first (override mature detection)
  for (const indicator of SAFE_INDICATORS) {
    if (combinedText.includes(indicator)) {
      return {
        isMature: false,
        hasContentWarning: false,
        isSafe: true,
      };
    }
  }

  // Check for mature keywords
  for (const keyword of MATURE_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      isMature = true;
      reason = `Contains mature keyword: "${keyword}"`;
      break;
    }
  }

  // Check for YouTube age restrictions
  if (content.source === "youtube" && content.ageRestricted) {
    isMature = true;
    reason = "YouTube age-restricted content";
  }

  // Check for Bluesky content warnings
  if (content.source === "bluesky" && content.hasContentWarning) {
    isMature = true;
    reason = "Bluesky content warning";
  }

  // Check for explicit category
  const category = (content.category || "").toLowerCase();
  if (category.includes("adult") || category.includes("mature")) {
    isMature = true;
    reason = "Adult/Mature category";
  }

  // Specific patterns that indicate mature art content
  // (addressing user concern: "Queer art brings too much nudity")
  if (
    (title.includes("art") || description.includes("art")) &&
    (combinedText.includes("body") ||
      combinedText.includes("form") ||
      combinedText.includes("figure"))
  ) {
    // This might be artistic nudity - flag as mature but not explicit
    if (
      combinedText.includes("nude") ||
      combinedText.includes("naked") ||
      combinedText.includes("body paint")
    ) {
      isMature = true;
      reason = "Artistic nudity content";
    }
  }

  return {
    isMature,
    hasContentWarning: isMature,
    isSafe: !isMature,
    reason: isMature ? reason : undefined,
  };
}

/**
 * Apply content filter to an array of content
 * Returns filtered array based on user preferences
 */
export function applyContentFilter<T extends Video | any>(
  items: T[],
  filter: ContentFilter
): T[] {
  let filtered = items;

  // Safe mode: Filter out mature content
  if (filter.safeMode) {
    filtered = filtered.filter((item) => {
      const flags = detectMatureContent(item);
      return flags.isSafe;
    });
  }

  // Content type filter
  if (filter.contentTypes && filter.contentTypes.length > 0) {
    filtered = filtered.filter((item) =>
      filter.contentTypes.includes(item.contentType)
    );
  }

  // Category filter
  if (filter.categories && filter.categories.length > 0) {
    filtered = filtered.filter((item) =>
      filter.categories.includes(item.category)
    );
  }

  // Platform filter
  if (filter.platforms && filter.platforms.length > 0) {
    filtered = filtered.filter((item) =>
      filter.platforms.includes(item.source)
    );
  }

  // Quality score filter
  if (filter.minQualityScore !== undefined) {
    // This would require importing quality-score module
    // For now, we'll skip this to avoid circular dependencies
    // It should be applied in the calling code
  }

  // Exclude creators (block list)
  if (filter.excludeCreators && filter.excludeCreators.length > 0) {
    filtered = filtered.filter(
      (item) =>
        !filter.excludeCreators!.includes(item.creator?.did || "") &&
        !filter.excludeCreators!.includes(item.creator?.handle || "")
    );
  }

  // Following only filter
  // This would require user's following list
  // Should be applied in the calling code where user data is available

  return filtered;
}

/**
 * Get default safe filter for new users
 */
export function getDefaultSafeFilter(): ContentFilter {
  return {
    safeMode: true,
    contentTypes: ["short", "long", "podcast", "photo"],
    categories: [
      "Performance",
      "Tutorial",
      "Comedy",
      "Fashion",
      "Music",
      "Interview",
      "Behind the Scenes",
    ],
    platforms: ["dragverse", "bluesky", "youtube"],
    minQualityScore: 40, // Minimum acceptable quality
  };
}

/**
 * Get permissive filter for mature audiences
 */
export function getPermissiveFilter(): ContentFilter {
  return {
    safeMode: false,
    contentTypes: ["short", "long", "podcast", "photo"],
    categories: [], // All categories
    platforms: ["dragverse", "bluesky", "youtube"],
    minQualityScore: 30, // Lower threshold
  };
}

/**
 * Save user filter preferences to localStorage
 */
export function saveFilterPreferences(filter: ContentFilter): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("dragverse_content_filter", JSON.stringify(filter));
}

/**
 * Load user filter preferences from localStorage
 */
export function loadFilterPreferences(): ContentFilter | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("dragverse_content_filter");
  if (!stored) return null;

  try {
    return JSON.parse(stored) as ContentFilter;
  } catch (error) {
    console.error("Failed to parse stored filter preferences:", error);
    return null;
  }
}

/**
 * Get filter for current user (or default)
 */
export function getUserFilter(): ContentFilter {
  const stored = loadFilterPreferences();
  return stored || getDefaultSafeFilter();
}

/**
 * Batch flag content items
 * Returns items with flags attached
 */
export function flagContentBatch<T extends Video | any>(
  items: T[]
): Array<T & { contentFlags: ContentFlags }> {
  return items.map((item) => ({
    ...item,
    contentFlags: detectMatureContent(item),
  }));
}

/**
 * Check if content passes filter
 */
export function passesFilter(content: Video | any, filter: ContentFilter): boolean {
  const flags = detectMatureContent(content);

  // Safe mode check
  if (filter.safeMode && !flags.isSafe) {
    return false;
  }

  // Content type check
  if (
    filter.contentTypes.length > 0 &&
    !filter.contentTypes.includes(content.contentType)
  ) {
    return false;
  }

  // Category check
  if (
    filter.categories.length > 0 &&
    !filter.categories.includes(content.category)
  ) {
    return false;
  }

  // Platform check
  if (
    filter.platforms.length > 0 &&
    !filter.platforms.includes(content.source)
  ) {
    return false;
  }

  // Blocked creator check
  if (filter.excludeCreators && filter.excludeCreators.length > 0) {
    if (
      filter.excludeCreators.includes(content.creator?.did || "") ||
      filter.excludeCreators.includes(content.creator?.handle || "")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get content filter statistics
 */
export function getFilterStats<T extends Video | any>(
  items: T[],
  filter: ContentFilter
): {
  total: number;
  filtered: number;
  matureFiltered: number;
  categoryFiltered: number;
  platformFiltered: number;
} {
  const flagged = flagContentBatch(items);

  let matureFiltered = 0;
  let categoryFiltered = 0;
  let platformFiltered = 0;

  for (const item of flagged) {
    if (filter.safeMode && !item.contentFlags.isSafe) {
      matureFiltered++;
    }
    if (
      filter.categories.length > 0 &&
      !filter.categories.includes(item.category)
    ) {
      categoryFiltered++;
    }
    if (
      filter.platforms.length > 0 &&
      !filter.platforms.includes(item.source)
    ) {
      platformFiltered++;
    }
  }

  const filtered = applyContentFilter(items, filter);

  return {
    total: items.length,
    filtered: filtered.length,
    matureFiltered,
    categoryFiltered,
    platformFiltered,
  };
}
