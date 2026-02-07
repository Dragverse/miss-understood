/**
 * Thumbnail and playback URL validation utilities
 */

/**
 * Extract playback ID from Livepeer playback URL
 */
function extractPlaybackId(playbackUrl: string): string | null {
  try {
    // Extract from URLs like:
    // - https://livepeercdn.studio/hls/{playbackId}/index.m3u8
    // - https://livepeercdn.com/recordings/{playbackId}/index.m3u8
    const match = playbackUrl.match(/\/(?:hls|recordings)\/([a-zA-Z0-9]+)\//);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Validate and get a safe thumbnail URL with intelligent fallback chain
 * Priority: provided thumbnail → Livepeer auto-thumbnail → fallback
 */
export function getSafeThumbnail(
  thumbnail: string | null | undefined,
  fallback: string = '/default-thumbnail.jpg',
  playbackUrl?: string,
  playbackId?: string
): string {
  // 1. Try provided thumbnail if valid
  if (thumbnail && thumbnail.trim() !== '' && !thumbnail.includes('default-thumbnail')) {
    // Reject blob URLs (from old broken uploads)
    if (thumbnail.startsWith('blob:')) {
      console.warn('[Thumbnail] Rejecting blob URL:', thumbnail);
      // Continue to fallback chain
    }
    // Reject data URLs that are too large or invalid
    else if (thumbnail.startsWith('data:')) {
      console.warn('[Thumbnail] Rejecting data URL (too large or invalid)');
      // Continue to fallback chain
    }
    // Try to use the thumbnail URL
    else {
      try {
        new URL(thumbnail);
        return thumbnail;
      } catch {
        // Invalid URL, continue to fallback chain
      }
    }
  }

  // 2. Try Livepeer auto-generated thumbnail if playbackId provided directly
  if (playbackId && playbackId.trim() !== '') {
    return `https://image.lp-playback.studio/image/${playbackId}/thumbnail.webp`;
  }

  // 3. Try Livepeer auto-generated thumbnail if playbackUrl provided
  if (playbackUrl) {
    const extractedPlaybackId = extractPlaybackId(playbackUrl);
    if (extractedPlaybackId) {
      return `https://image.lp-playback.studio/image/${extractedPlaybackId}/thumbnail.webp`;
    }
  }

  // 4. Final fallback
  return fallback;
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
