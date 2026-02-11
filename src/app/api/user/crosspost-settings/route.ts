import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session/config";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/crosspost-settings
 * Fetch user's default cross-posting platform preferences
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    // Fetch creator record with crosspost settings
    const { data: creator, error } = await supabase
      .from("creators")
      .select("default_crosspost_platforms, bluesky_handle, farcaster_fid, farcaster_signer_uuid")
      .eq("did", userId)
      .single();

    if (error || !creator) {
      return NextResponse.json(
        {
          success: true,
          settings: { bluesky: false, farcaster: false },
          connected: { bluesky: false, farcaster: false }
        }
      );
    }

    const settings = creator.default_crosspost_platforms || { bluesky: false, farcaster: false };

    // Cross-check with iron-session for Bluesky (session is source of truth)
    const response = NextResponse.json({ success: true });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    // Bluesky connected if EITHER session OR database has handle
    let blueskyConnected = !!(creator.bluesky_handle || session.bluesky?.handle);

    // Self-healing: If session exists but database doesn't, sync them
    if (session.bluesky?.handle && !creator.bluesky_handle) {
      console.log("[Crosspost Settings] Self-healing: Syncing session to database");
      try {
        await supabase
          .from("creators")
          .update({
            bluesky_handle: session.bluesky.handle,
            bluesky_did: session.bluesky.did || "",
            updated_at: new Date().toISOString(),
          })
          .eq("did", userId);
        blueskyConnected = true;
      } catch (syncError) {
        console.error("[Crosspost Settings] Self-healing sync failed:", syncError);
      }
    }

    // Farcaster: Check if user has Farcaster FID (from Privy connection)
    // We use the free Warpcast sharing method, so no need to check Neynar signer approval
    let farcasterConnected = !!creator.farcaster_fid;
    console.log("[Crosspost Settings] Farcaster connection check:", {
      hasFID: !!creator.farcaster_fid,
      connected: farcasterConnected,
    });

    const connected = {
      bluesky: blueskyConnected,
      farcaster: farcasterConnected,
    };

    return NextResponse.json({
      success: true,
      settings,
      connected,
    });
  } catch (error) {
    console.error("[Crosspost Settings API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crosspost settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/crosspost-settings
 * Update user's default cross-posting platform preferences
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await request.json();
    const { bluesky, farcaster } = body;

    // Validate input
    if (typeof bluesky !== "boolean" || typeof farcaster !== "boolean") {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Update creator record
    const { error } = await supabase
      .from("creators")
      .update({
        default_crosspost_platforms: { bluesky, farcaster },
        updated_at: new Date().toISOString()
      })
      .eq("did", userId);

    if (error) {
      console.error("[Crosspost Settings API] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: { bluesky, farcaster }
    });
  } catch (error) {
    console.error("[Crosspost Settings API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update crosspost settings" },
      { status: 500 }
    );
  }
}
