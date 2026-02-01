import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

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
      .select("default_crosspost_platforms, bluesky_handle, farcaster_fid")
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
    const connected = {
      bluesky: !!creator.bluesky_handle,
      farcaster: !!creator.farcaster_fid
    };

    return NextResponse.json({
      success: true,
      settings,
      connected
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
