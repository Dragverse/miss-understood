/**
 * Content Quality Scoring System
 *
 * Ranks content based on multiple factors to surface the best drag content.
 * Used across all content types: videos, posts, photos.
 */

import { Video } from "@/types";

export interface ContentQualityScore {
  engagement: number;         // 0-100: likes, comments, shares
  recency: number;            // 0-100: how fresh the content is
  creatorReputation: number;  // 0-100: follower count, verified status
  contentRelevance: number;   // 0-100: drag-related keywords, hashtags
  overallScore: number;       // weighted average
  breakdown?: {
    engagementDetails: string;
    recencyDetails: string;
    reputationDetails: string;
    relevanceDetails: string;
  };
}

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
  engagement: 0.40,      // 40%
  recency: 0.25,         // 25%
  reputation: 0.20,      // 20%
  relevance: 0.15,       // 15%
};

// Drag-related keywords for relevance scoring
const DRAG_KEYWORDS = [
  // Core terms
  "drag", "queen", "king", "dragrace", "rupaulsdragrace", "dragula",
  // Performance types
  "lipsynch", "lipsync", "performance", "show", "pageant",
  // Style & makeup
  "makeup", "transformation", "beat", "contour", "wig", "gown", "look",
  // Community
  "slay", "werk", "serve", "fierce", "legendary", "iconic",
  // Events
  "pride", "ball", "competition", "runway",
  // Shows
  "allstars", "untucked", "werq", "wow",
];

const DRAG_HASHTAGS = [
  "#drag", "#dragqueen", "#dragking", "#dragrace", "#rupaulsdragrace",
  "#dragmakeup", "#dragshow", "#dragperformance", "#dragart",
  "#dragula", "#allstars", "#pride", "#lgbtq", "#queer",
];

/**
 * Calculate engagement score (0-100)
 * Based on likes, views, comments, shares relative to creator size
 */
function calculateEngagementScore(content: Video | any): number {
  const likes = content.likes || 0;
  const views = content.views || 0;
  const comments = content.replyCount || content.comments || 0;
  const shares = content.repostCount || content.shares || 0;

  // Engagement rate: interactions / impressions
  const totalInteractions = likes + comments * 2 + shares * 3;
  const engagementRate = views > 0 ? (totalInteractions / views) * 100 : 0;

  // Normalize to 0-100 scale
  // Excellent engagement rate is 5%+, good is 2%+, average is 0.5%+
  let score = 0;
  if (engagementRate >= 5) {
    score = 100;
  } else if (engagementRate >= 2) {
    score = 70 + (engagementRate - 2) * 10; // 70-100
  } else if (engagementRate >= 0.5) {
    score = 40 + (engagementRate - 0.5) * 20; // 40-70
  } else {
    score = engagementRate * 80; // 0-40
  }

  // Boost for absolute engagement (popular content)
  if (likes > 10000) score = Math.min(100, score + 20);
  else if (likes > 1000) score = Math.min(100, score + 10);
  else if (likes > 100) score = Math.min(100, score + 5);

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate recency score (0-100)
 * Newer content gets higher scores with exponential decay
 */
function calculateRecencyScore(content: Video | any): number {
  const now = Date.now();
  const createdAt = content.createdAt ? new Date(content.createdAt).getTime() : now;
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);

  // Exponential decay over time
  // 100% for < 1 hour, 90% at 3 hours, 75% at 12 hours, 50% at 24 hours, 25% at 48 hours
  let score = 0;
  if (ageInHours < 1) {
    score = 100;
  } else if (ageInHours < 3) {
    score = 100 - (ageInHours - 1) * 5; // 100 -> 90
  } else if (ageInHours < 12) {
    score = 90 - (ageInHours - 3) * 1.67; // 90 -> 75
  } else if (ageInHours < 24) {
    score = 75 - (ageInHours - 12) * 2.08; // 75 -> 50
  } else if (ageInHours < 48) {
    score = 50 - (ageInHours - 24) * 1.04; // 50 -> 25
  } else if (ageInHours < 168) { // 1 week
    score = 25 - (ageInHours - 48) * 0.17; // 25 -> 5
  } else {
    score = 5; // Minimum for older content
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate creator reputation score (0-100)
 * Based on follower count, verified status, platform
 */
function calculateCreatorReputationScore(content: Video | any): number {
  const creator = content.creator || {};
  const followers = creator.followerCount || 0;
  const isVerified = creator.verified || false;
  const source = content.source || "dragverse";

  let score = 0;

  // Follower count scoring (logarithmic scale)
  if (followers >= 1000000) {
    score = 90; // 1M+ followers
  } else if (followers >= 100000) {
    score = 75; // 100K+ followers
  } else if (followers >= 10000) {
    score = 60; // 10K+ followers
  } else if (followers >= 1000) {
    score = 45; // 1K+ followers
  } else if (followers >= 100) {
    score = 30; // 100+ followers
  } else {
    score = 15; // < 100 followers
  }

  // Verified status boost
  if (isVerified) {
    score = Math.min(100, score + 15);
  }

  // Platform reputation
  // Native Dragverse creators get small boost (supporting the platform)
  if (source === "dragverse") {
    score = Math.min(100, score + 5);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate content relevance score (0-100)
 * Based on drag-related keywords and hashtags in title/description
 */
function calculateContentRelevanceScore(content: Video | any): number {
  const title = (content.title || "").toLowerCase();
  const description = (content.description || "").toLowerCase();
  const tags = content.tags || [];
  const category = (content.category || "").toLowerCase();
  const combinedText = `${title} ${description} ${tags.join(" ")}`;

  let score = 0;

  // Keyword matching
  let keywordMatches = 0;
  for (const keyword of DRAG_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  }

  // Hashtag matching
  let hashtagMatches = 0;
  for (const hashtag of DRAG_HASHTAGS) {
    if (combinedText.includes(hashtag.toLowerCase())) {
      hashtagMatches++;
    }
  }

  // Scoring based on matches
  score += Math.min(50, keywordMatches * 5);  // Up to 50 points from keywords
  score += Math.min(30, hashtagMatches * 10); // Up to 30 points from hashtags

  // Category boost
  if (category.includes("drag") || category === "performance") {
    score += 20;
  }

  // Drag tag boost
  if (tags.some((tag: string) => tag.toLowerCase().includes("drag"))) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate overall quality score for content
 * Returns score object with breakdown
 */
export function calculateQualityScore(content: Video | any, includeBreakdown = false): ContentQualityScore {
  const engagement = calculateEngagementScore(content);
  const recency = calculateRecencyScore(content);
  const creatorReputation = calculateCreatorReputationScore(content);
  const contentRelevance = calculateContentRelevanceScore(content);

  // Weighted average
  const overallScore =
    engagement * WEIGHTS.engagement +
    recency * WEIGHTS.recency +
    creatorReputation * WEIGHTS.reputation +
    contentRelevance * WEIGHTS.relevance;

  const result: ContentQualityScore = {
    engagement,
    recency,
    creatorReputation,
    contentRelevance,
    overallScore: Math.round(overallScore * 10) / 10, // Round to 1 decimal
  };

  if (includeBreakdown) {
    result.breakdown = {
      engagementDetails: `${engagement.toFixed(1)}/100 (${content.likes || 0} likes, ${content.views || 0} views)`,
      recencyDetails: `${recency.toFixed(1)}/100 (${getAgeDescription(content.createdAt)})`,
      reputationDetails: `${creatorReputation.toFixed(1)}/100 (${content.creator?.followerCount || 0} followers${content.creator?.verified ? ", verified" : ""})`,
      relevanceDetails: `${contentRelevance.toFixed(1)}/100 (drag-related content)`,
    };
  }

  return result;
}

/**
 * Rank content by quality score
 * Returns sorted array with highest quality first
 */
export function rankContentByQuality<T extends Video | any>(items: T[]): T[] {
  return items
    .map((item) => ({
      item,
      score: calculateQualityScore(item),
    }))
    .sort((a, b) => b.score.overallScore - a.score.overallScore)
    .map((ranked) => ranked.item);
}

/**
 * Filter content by minimum quality score
 */
export function filterByQuality<T extends Video | any>(
  items: T[],
  minScore: number = 40
): T[] {
  return items.filter((item) => {
    const score = calculateQualityScore(item);
    return score.overallScore >= minScore;
  });
}

/**
 * Get age description for human-readable display
 */
function getAgeDescription(createdAt: Date | string | undefined): string {
  if (!createdAt) return "Unknown age";

  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const ageInMs = now - created;

  const minutes = Math.floor(ageInMs / (1000 * 60));
  const hours = Math.floor(ageInMs / (1000 * 60 * 60));
  const days = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Batch score content items
 * Returns items with scores attached
 */
export function scoreContentBatch<T extends Video | any>(
  items: T[]
): Array<T & { qualityScore: ContentQualityScore }> {
  return items.map((item) => ({
    ...(item as any),
    qualityScore: calculateQualityScore(item),
  }));
}
