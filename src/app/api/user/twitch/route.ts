import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * PUT /api/user/twitch  { handle: string | null }
 *
 * Sets just the caller's Twitch handle.
 *
 * Deliberately NOT /api/profile/update: that route upserts the whole creator
 * row, so a body carrying only a Twitch handle would blank out display name,
 * avatar, banner and every other social. A targeted UPDATE touches one column.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const raw = body?.handle;

    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "handle must be a string or null" }, { status: 400 });
    }

    // Twitch usernames are 4-25 chars, letters/digits/underscore. Normalising
    // here means the Helix lookup and the profile link always agree.
    const handle = raw === null ? null : raw.trim().replace(/^@/, "").toLowerCase();
    if (handle && !/^[a-z0-9_]{4,25}$/.test(handle)) {
      return NextResponse.json({ error: "That doesn't look like a Twitch username" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("creators")
      .update({ twitch_handle: handle, updated_at: new Date().toISOString() })
      .eq("did", auth.userId);

    if (error) {
      console.error("[Twitch] Failed to save handle:", error);
      return NextResponse.json({ error: "Failed to save Twitch handle" }, { status: 500 });
    }

    return NextResponse.json({ success: true, handle });
  } catch (error) {
    console.error("[Twitch] Save handle error:", error);
    return NextResponse.json({ error: "Failed to save Twitch handle" }, { status: 500 });
  }
}
