/**
 * Farcaster sharing utilities
 * Opens Warpcast with pre-filled content (free alternative to managed signers)
 */

interface ShareToWarpcastOptions {
  text: string;
  embedUrl?: string;
  channelKey?: string; // e.g., "dragverse"
}

/**
 * Opens Warpcast composer with pre-filled content
 * Uses Warpcast's URL scheme to deep-link into the app
 */
export function shareToWarpcast({ text, embedUrl, channelKey }: ShareToWarpcastOptions): void {
  const params = new URLSearchParams();

  // Add text content
  params.append('text', text);

  // Add embed (video/post URL)
  if (embedUrl) {
    params.append('embeds[]', embedUrl);
  }

  // Add channel (e.g., /dragverse)
  if (channelKey) {
    params.append('channelKey', channelKey);
  }

  // Open Warpcast in new tab
  const warpcastUrl = `https://warpcast.com/~/compose?${params.toString()}`;
  window.open(warpcastUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Generate shareable text for a video
 */
export function generateVideoShareText(title: string, creatorHandle: string): string {
  return `Check out "${title}" by @${creatorHandle} on Dragverse! 🎬`;
}

/**
 * Generate shareable text for a post
 */
export function generatePostShareText(content: string, maxLength: number = 280): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + '...';
}
