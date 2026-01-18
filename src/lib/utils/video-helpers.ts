/**
 * Video playback helpers
 */

/**
 * Check if URL is a YouTube video
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com/watch') || url.includes('youtu.be/');
}

/**
 * Extract YouTube video ID from URL
 */
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // Handle youtu.be/VIDEO_ID format
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  // Handle youtube.com/watch?v=VIDEO_ID format
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];

  return null;
}

/**
 * Get YouTube embed URL
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
