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
    // Data URLs are valid embedded images - allow them
    else if (thumbnail.startsWith('data:')) {
      return thumbnail;
    }
    // Reject Supabase .blob files (failed uploads that stored filename instead of URL)
    else if (thumbnail.includes('.blob') && thumbnail.includes('supabase')) {
      console.warn('[Thumbnail] Rejecting broken Supabase .blob URL:', thumbnail);
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

/**
 * Get safe avatar URL with simpler validation for profile pictures
 * Only rejects obviously broken URLs, keeps valid ones
 */
export function getSafeAvatar(
  avatar: string | null | undefined,
  fallback: string = '/defaultpfp.png'
): string {
  // If no avatar provided, use fallback
  if (!avatar || avatar.trim() === '') {
    return fallback;
  }

  // Reject blob URLs (from old broken uploads)
  if (avatar.startsWith('blob:')) {
    console.warn('[Avatar] Rejecting blob URL:', avatar);
    return fallback;
  }

  // Data URLs are valid embedded images - allow them
  if (avatar.startsWith('data:')) {
    return avatar;
  }

  // Reject Supabase .blob files (failed uploads that stored filename instead of URL)
  if (avatar.includes('.blob') && avatar.includes('supabase')) {
    console.warn('[Avatar] Rejecting broken Supabase .blob URL:', avatar);
    return fallback;
  }

  // Try to validate as URL
  try {
    new URL(avatar);
    return avatar; // Valid URL, use it
  } catch {
    // Invalid URL format, use fallback
    console.warn('[Avatar] Invalid URL format:', avatar);
    return fallback;
  }
}
