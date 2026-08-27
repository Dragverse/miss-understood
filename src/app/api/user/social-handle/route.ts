import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Platforms whose handle is set by connecting the account, not by typing.
 *
 * Each pattern is the platform's own username rule, applied after normalising
 * away a leading @ and lowercasing — so what we store always matches what the
 * platform's API and profile URL expect.
 */
const PLATFORMS = {
  twitch: { column: "twitch_handle", pattern: /^[a-z0-9_]{4,25}$/, label: "Twitch" },
  instagram: { column: "instagram_handle", pattern: /^[a-z0-9._]{1,30}$/, label: "Instagram" },
} as const;

type Platform = keyof typeof PLATFORMS;

/**
 * PUT /api/user/social-handle  { platform, handle: string | null }
 *
 * Sets one social handle on the caller's own row.
 *
 * Deliberately NOT /api/profile/update: that route upserts the whole creator
 * row, so a body carrying a single handle would blank out display name,
 * avatar, banner and every other social. This touches one column.
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
    const platform = body?.platform as Platform;
    const raw = body?.handle;

    const config = PLATFORMS[platform];
    if (!config) {
      return NextResponse.json(
        { error: `platform must be one of: ${Object.keys(PLATFORMS).join(", ")}` },
        { status: 400 }
      );
    }
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "handle must be a string or null" }, { status: 400 });
    }

    const handle = raw === null ? null : raw.trim().replace(/^@/, "").toLowerCase();
    if (handle && !config.pattern.test(handle)) {
      return NextResponse.json(
        { error: `That doesn't look like a ${config.label} username` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("creators")
      .update({ [config.column]: handle, updated_at: new Date().toISOString() })
      .eq("did", auth.userId);

    if (error) {
      console.error(`[SocialHandle] Failed to save ${platform}:`, error);
      return NextResponse.json({ error: `Failed to save ${config.label} handle` }, { status: 500 });
    }

    return NextResponse.json({ success: true, platform, handle });
  } catch (error) {
    console.error("[SocialHandle] Error:", error);
    return NextResponse.json({ error: "Failed to save handle" }, { status: 500 });
  }
}
