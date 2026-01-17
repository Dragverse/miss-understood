import { SessionOptions } from "iron-session";

/**
 * Bluesky session data stored in secure HTTP-only cookie
 */
export interface BlueskySessionData {
  handle: string;
  appPassword: string; // Encrypted by iron-session automatically
  did?: string;
  displayName?: string;
  avatar?: string;
  connectedAt: number;
}

/**
 * Complete session data structure
 */
export interface SessionData {
  bluesky?: BlueskySessionData;
}

/**
 * iron-session configuration
 * - Uses HTTP-only cookies (prevents XSS)
 * - Encrypted with SESSION_SECRET
 * - 7-day expiry
 * - Secure flag in production
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "dragverse_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: "/",
  },
};

/**
 * Get typed session from request/response
 */
export async function getSession(req: Request): Promise<SessionData> {
  const { getIronSession } = await import("iron-session");
  const response = new Response();
  return await getIronSession<SessionData>(req, response, sessionOptions);
}
