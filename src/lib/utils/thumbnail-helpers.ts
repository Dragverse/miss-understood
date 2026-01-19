/**
 * Thumbnail and playback URL validation utilities
 */

/**
 * Validate and get a safe thumbnail URL
 * Returns the URL if valid, or a fallback
 */
export function getSafeThumbnail(
  thumbnail: string | null | undefined,
  fallback: string = '/default-thumbnail.jpg'
): string {
  // Check if thumbnail exists and is non-empty
  if (!thumbnail || thumbnail.trim() === '') {
    return fallback;
  }

  // Check if it's a valid URL format
  try {
    new URL(thumbnail);
    return thumbnail;
  } catch {
    return fallback;
  }
}

/**
 * Get YouTube thumbnail with guaranteed fallback
 */
export function getYouTubeThumbnail(videoId: string): string {
  if (!videoId) return '/default-thumbnail.jpg';
  // Use hqdefault.jpg - guaranteed to exist for all YouTube videos
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Validate playback URL
 */
export function isValidPlaybackUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === '') return false;
  if (url === 'null' || url === 'undefined') return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
