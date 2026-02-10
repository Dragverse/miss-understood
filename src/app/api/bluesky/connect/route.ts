import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { validateBlueskyCredentials } from "@/lib/session/bluesky";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

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

    // Sync connection to database for consistent status checking across all pages
    try {
      const auth = await verifyAuth(request);
      if (auth.authenticated && auth.userId) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabase
          .from("creators")
          .update({
            bluesky_handle: validation.data!.handle,
            bluesky_did: validation.data!.did || "",
            updated_at: new Date().toISOString(),
          })
          .eq("did", auth.userId);

        if (updateError) {
          console.error("[Bluesky Connect] Database sync failed:", updateError);
        } else {
          console.log("[Bluesky Connect] ✅ Synced connection to database");
        }
      }
    } catch (syncError) {
      // Non-fatal error - session is already saved, database sync is supplementary
      console.error("[Bluesky Connect] Database sync error:", syncError);
    }

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
