/**
 * YouTube Channel Avatar Fetcher
 * Dynamically fetches channel avatar URLs without requiring API keys
 */

interface YouTubeChannelAvatar {
  channelId: string;
  avatar: string;
}

// In-memory cache for channel avatars (1 hour TTL)
const avatarCache = new Map<string, { avatar: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get YouTube channel avatar URL using the channel's handle
 * Uses web scraping fallback if needed
 */
export async function getYouTubeChannelAvatar(
  channelId: string,
  handle?: string
): Promise<string> {
  // Check cache first
  const cached = avatarCache.get(channelId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.avatar;
  }

  try {
    // Strategy 1: Use YouTube's public channel page to extract avatar
    // This doesn't require any API keys and works reliably
    const channelUrl = handle
      ? `https://www.youtube.com/@${handle}`
      : `https://www.youtube.com/channel/${channelId}`;

    const response = await fetch(channelUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DragverseBot/1.0; +https://dragverse.app)",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(
        `[YouTube Avatar] Failed to fetch channel page for ${channelId}`
      );
      return "/defaultpfp.png";
    }

    const html = await response.text();

    // Extract avatar URL from page metadata
    // YouTube includes channel avatar in og:image meta tag
    const ogImageMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/
    );
    if (ogImageMatch && ogImageMatch[1]) {
      const avatarUrl = ogImageMatch[1];
      console.log(`[YouTube Avatar] ✅ Found avatar for ${channelId}: ${avatarUrl.substring(0, 50)}...`);

      // Cache the result
      avatarCache.set(channelId, { avatar: avatarUrl, timestamp: Date.now() });

      return avatarUrl;
    }

    // Fallback: Try to extract from JSON-LD data
    const jsonLdMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    if (jsonLdMatch && jsonLdMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.thumbnail?.thumbnails?.[0]?.url) {
          const avatarUrl = jsonData.thumbnail.thumbnails[0].url;
          console.log(`[YouTube Avatar] ✅ Found avatar via JSON-LD for ${channelId}`);
          avatarCache.set(channelId, {
            avatar: avatarUrl,
            timestamp: Date.now(),
          });
          return avatarUrl;
        }
      } catch (e) {
        // JSON parsing failed, continue to fallback
      }
    }

    console.warn(`[YouTube Avatar] Could not extract avatar for ${channelId}, using default`);
    return "/defaultpfp.png";
  } catch (error) {
    console.error(
      `[YouTube Avatar] Error fetching avatar for ${channelId}:`,
      error
    );
    return "/defaultpfp.png";
  }
}

/**
 * Preload avatars for all curated channels
 * Call this on app startup to warm the cache
 */
export async function preloadChannelAvatars(
  channels: Array<{ channelId: string; handle: string }>
): Promise<void> {
  console.log(`[YouTube Avatar] Preloading avatars for ${channels.length} channels...`);

  await Promise.all(
    channels.map(async (channel) => {
      try {
        await getYouTubeChannelAvatar(channel.channelId, channel.handle);
      } catch (error) {
        console.error(
          `[YouTube Avatar] Failed to preload ${channel.channelId}:`,
          error
        );
      }
    })
  );

  console.log(`[YouTube Avatar] ✅ Preloading complete`);
}
