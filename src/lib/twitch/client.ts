/**
 * Twitch Helix client.
 *
 * Uses an *app* access token (client credentials), not per-creator OAuth. The
 * follower total is readable that way: `moderator:read:followers` is only
 * needed for the follower *list*, and app tokens don't carry scopes at all, so
 * `GET /helix/channels/followers` returns an empty `data` array but a populated
 * `total`. That means a creator only has to tell us their username — no
 * consent flow, no app review, no account-type requirement.
 *
 * Everything degrades to null when credentials aren't configured, so the rest
 * of the app behaves as if Twitch simply isn't connected.
 */

const HELIX = "https://api.twitch.tv/helix";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export function isTwitchConfigured(): boolean {
  return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

// App tokens last ~60 days. Cached in module scope and refreshed a minute
// early; a serverless cold start just mints a new one.
let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlight: Promise<string | null> | null = null;

/**
 * Fetch (or reuse) the app access token.
 *
 * Deduplicated: concurrent callers await one request rather than each minting
 * their own. Getting this wrong is exactly what broke the Bluesky client —
 * parallel logins tripped that provider's rate limit and the feed silently
 * returned nothing for weeks.
 */
async function getAppToken(): Promise<string | null> {
  if (!isTwitchConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        grant_type: "client_credentials",
      });

      const response = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
      if (!response.ok) {
        console.error("[Twitch] Token request failed:", response.status);
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number };
      cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + Math.max(0, (data.expires_in - 60) * 1000),
      };
      return cachedToken.value;
    } catch (error) {
      console.error("[Twitch] Token request error:", error);
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function helix<T>(path: string): Promise<T | null> {
  const token = await getAppToken();
  if (!token) return null;

  try {
    const response = await fetch(`${HELIX}${path}`, {
      headers: {
        "Client-Id": process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      // Token rejected — drop it so the next call mints a fresh one.
      cachedToken = null;
      console.warn("[Twitch] App token rejected, cleared cache");
      return null;
    }
    if (!response.ok) {
      console.warn(`[Twitch] ${path} -> ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[Twitch] ${path} failed:`, error);
    return null;
  }
}

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  avatar: string;
  description: string;
}

/** Resolve a username to a Twitch user. Null if unconfigured or not found. */
export async function getTwitchUser(login: string): Promise<TwitchUser | null> {
  const clean = login.trim().replace(/^@/, "").toLowerCase();
  if (!clean) return null;

  const data = await helix<{
    data: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
      description: string;
    }>;
  }>(`/users?login=${encodeURIComponent(clean)}`);

  const user = data?.data?.[0];
  if (!user) return null;

  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    avatar: user.profile_image_url,
    description: user.description,
  };
}

/**
 * Follower total for a broadcaster id.
 *
 * `data` comes back empty without the moderator scope; `total` does not.
 */
export async function getTwitchFollowerCount(broadcasterId: string): Promise<number | null> {
  const data = await helix<{ total: number }>(
    `/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}`
  );
  return typeof data?.total === "number" ? data.total : null;
}

export interface TwitchStream {
  title: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
  gameName: string;
}

/** The creator's current stream, or null when they're offline. */
export async function getTwitchStream(login: string): Promise<TwitchStream | null> {
  const clean = login.trim().replace(/^@/, "").toLowerCase();
  if (!clean) return null;

  const data = await helix<{
    data: Array<{
      title: string;
      viewer_count: number;
      started_at: string;
      thumbnail_url: string;
      game_name: string;
    }>;
  }>(`/streams?user_login=${encodeURIComponent(clean)}`);

  const stream = data?.data?.[0];
  if (!stream) return null;

  return {
    title: stream.title,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    // Twitch returns a template URL with {width}x{height} placeholders.
    thumbnailUrl: stream.thumbnail_url.replace("{width}", "640").replace("{height}", "360"),
    gameName: stream.game_name,
  };
}

/** Username -> follower count in one call, for the stats aggregator. */
export async function getTwitchFollowersByLogin(login: string): Promise<number | null> {
  const user = await getTwitchUser(login);
  if (!user) return null;
  return getTwitchFollowerCount(user.id);
}
