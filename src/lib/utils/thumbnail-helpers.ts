/**
 * Simple, defensive thumbnail and avatar utilities
 * Philosophy: Use what we have, fall back gracefully
 */

/**
 * Get safe thumbnail URL - trusts valid URLs, falls back for broken ones
 * Simple rule: if it looks like a valid URL, use it. Otherwise, use fallback.
 */
export function getSafeThumbnail(
  thumbnail: string | null | undefined,
  fallback: string = '/default-thumbnail.jpg'
): string {
  // No thumbnail provided
  if (!thumbnail || thumbnail.trim() === '') {
    return fallback;
  }

  // Reject obviously broken URLs
  if (thumbnail.startsWith('blob:')) {
    return fallback;
  }

  // Data URLs are valid (base64-encoded images)
  if (thumbnail.startsWith('data:')) {
    return thumbnail;
  }

  // Try to validate as URL
  try {
    new URL(thumbnail);
    return thumbnail;
  } catch {
    return fallback;
  }
}

/**
 * Get safe avatar URL - same simple logic as thumbnails
 */
export function getSafeAvatar(
  avatar: string | null | undefined,
  fallback: string = '/defaultpfp.png'
): string {
  // No avatar provided
  if (!avatar || avatar.trim() === '') {
    return fallback;
  }

  // Reject obviously broken URLs
  if (avatar.startsWith('blob:')) {
    return fallback;
  }

  // Data URLs are valid (base64-encoded images)
  if (avatar.startsWith('data:')) {
    return avatar;
  }

  // Try to validate as URL
  try {
    new URL(avatar);
    return avatar;
  } catch {
    return fallback;
  }
}

/**
 * Get YouTube thumbnail with guaranteed fallback
 */
export function getYouTubeThumbnail(videoId: string): string {
  if (!videoId) return '/default-thumbnail.jpg';
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
