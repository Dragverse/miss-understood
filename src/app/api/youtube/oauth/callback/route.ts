import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/youtube/oauth/callback
 * Legacy OAuth callback - YouTube now uses direct channel entry instead.
 * Redirects to settings page.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  (process.env.NODE_ENV === 'production'
                    ? 'https://www.dragverse.app'
                    : 'http://localhost:3000');

  return NextResponse.redirect(`${baseUrl}/settings?tab=accounts`);
}
