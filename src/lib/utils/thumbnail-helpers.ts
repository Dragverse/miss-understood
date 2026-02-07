/**
 * Simple, defensive thumbnail and avatar utilities
 * Philosophy: Use what we have, fall back gracefully
 */

/**
 * Get safe thumbnail URL - trusts valid URLs, falls back for broken ones
 * Simple rule: if it looks like a valid URL, use it. Otherwise, use fallback.
 *
 * Optional: Pass playbackId to generate Livepeer thumbnail as fallback
 */
export function getSafeThumbnail(
  thumbnail: string | null | undefined,
  fallback: string = '/default-thumbnail.jpg',
  playbackId?: string | null
): string {
  // 1. Try provided thumbnail if valid
  if (thumbnail && thumbnail.trim() !== '') {
    // Reject obviously broken URLs
    if (thumbnail.startsWith('blob:')) {
      // Fall through to Livepeer or default fallback
    }
    // Data URLs are valid (base64-encoded images)
    else if (thumbnail.startsWith('data:')) {
      return thumbnail;
    }
    // Try to validate as URL
    else {
      try {
        new URL(thumbnail);
        return thumbnail;
      } catch {
        // Invalid URL, fall through
      }
    }
  }

  // 2. Try Livepeer auto-generated thumbnail if playbackId provided
  if (playbackId && playbackId.trim() !== '') {
    return `https://image.lp-playback.studio/image/${playbackId}/thumbnail.webp`;
  }

  // 3. Final fallback
  return fallback;
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

/**
 * Validate playback URL - simple check for valid URL
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
