import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { validateBlueskyCredentials } from "@/lib/session/bluesky";

/**
 * POST /api/bluesky/connect
 * Validates Bluesky credentials and stores in session if valid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle, appPassword } = body;

    // Validate input
    if (!handle || !appPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Handle and app password are required",
          errorType: "INVALID_HANDLE",
        },
        { status: 400 }
      );
    }

    // Validate credentials by attempting login
    const validation = await validateBlueskyCredentials(handle, appPassword);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          errorType: validation.errorType,
        },
        { status: 401 }
      );
    }

    // Credentials valid - store in session
    const response = NextResponse.json({
      success: true,
      handle: validation.data!.handle,
      displayName: validation.data!.displayName,
      connectedAt: validation.data!.connectedAt,
      message: "Bluesky account connected successfully!",
    });

    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    session.bluesky = validation.data!;
    await session.save();

    return response;
  } catch (error) {
    console.error("Bluesky connect error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again.",
        errorType: "SERVICE_ERROR",
      },
      { status: 500 }
    );
  }
}
