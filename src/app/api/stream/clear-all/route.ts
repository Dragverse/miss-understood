import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { createClient } from "@supabase/supabase-js";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stream/clear-all
 * Marks all of the authenticated user's streams as inactive
 * and terminates them on Livepeer so isActive resets immediately.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: streams, error } = await supabase
      .from("streams")
      .select("id, livepeer_stream_id")
      .eq("creator_did", auth.userId)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch streams" }, { status: 500 });
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json({ cleared: 0 });
    }

    // Mark all inactive in DB
    await supabase
      .from("streams")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("creator_did", auth.userId)
      .eq("is_active", true);

    // Terminate each on Livepeer (fire-and-forget)
    const apiKey = process.env.LIVEPEER_API_KEY;
    if (apiKey) {
      for (const stream of streams) {
        if (stream.livepeer_stream_id) {
          fetch(`${LIVEPEER_API_URL}/stream/${stream.livepeer_stream_id}/terminate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ cleared: streams.length });
  } catch (error) {
    console.error("Clear-all streams error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
