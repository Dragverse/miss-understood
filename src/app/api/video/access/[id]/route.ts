import { NextRequest, NextResponse } from "next/server";
import {
  validateVideoAccess,
  logVideoAccess,
  getClientIP,
} from "@/lib/middleware/video-access";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";

/**
 * GET /api/video/access/[id]
 * Validates if the user can access a video based on privacy settings
 * Query params:
 *   - token: Optional share token for private/unlisted videos
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const videoId = resolvedParams.id;
  const searchParams = request.nextUrl.searchParams;
  const shareToken = searchParams.get("token") || undefined;

  try {
    // Get authenticated user if available
    let userId: string | undefined;
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (auth.authenticated) {
        userId = auth.userId;
      }
    }

    // Validate access
    const accessResult = await validateVideoAccess(videoId, userId, shareToken);

    if (!accessResult.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          reason: accessResult.reason,
        },
        { status: 403 }
      );
    }

    // Log access
    const clientIP = getClientIP(request.headers);
    const userAgent = request.headers.get("user-agent") || undefined;
    const referer = request.headers.get("referer") || undefined;

    await logVideoAccess({
      video_id: videoId,
      viewer_ip: clientIP,
      viewer_did: userId,
      access_method: shareToken ? "share_token" : "direct",
      share_token_id: shareToken ? undefined : undefined, // Would need to be extracted from token validation
      user_agent: userAgent,
      referer: referer,
    });

    // Return video data with access granted
    return NextResponse.json({
      allowed: true,
      video: accessResult.video,
    });
  } catch (error) {
    console.error("Error checking video access:", error);
    return NextResponse.json(
      { error: "Failed to check video access" },
      { status: 500 }
    );
  }
}
