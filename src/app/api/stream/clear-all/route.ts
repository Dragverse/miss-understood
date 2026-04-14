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

    // Fetch all of the creator's streams: active ones in DB, plus any created
    // in the last 2 hours that Livepeer might still consider active (covers the
    // case where a previous partial clear marked DB inactive but didn't terminate Livepeer).
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const [activeResult, recentResult] = await Promise.all([
      supabase
        .from("streams")
        .select("id, livepeer_stream_id")
        .eq("creator_did", auth.userId)
        .eq("is_active", true),
      supabase
        .from("streams")
        .select("id, livepeer_stream_id")
        .eq("creator_did", auth.userId)
        .eq("is_active", false)
        .gte("updated_at", twoHoursAgo),
    ]);

    if (activeResult.error) {
      return NextResponse.json({ error: "Failed to fetch streams" }, { status: 500 });
    }

    // Merge, de-duplicate by id
    const allStreams = [...(activeResult.data ?? []), ...(recentResult.data ?? [])];
    const seen = new Set<string>();
    const streams = allStreams.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    if (streams.length === 0) {
      return NextResponse.json({ cleared: 0 });
    }

    // Mark all DB-active rows inactive
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

    // Broadcast "offline" to the realtime channel so the profile embed
    // switches to offline immediately — without this, the embed waits up to 15s
    // for its next poll and keeps showing the live player.
    try {
      await supabase.channel(`stream-status:${auth.userId}`).send({
        type: "broadcast",
        event: "offline",
        payload: {},
      });
    } catch {
      // Non-fatal — embed will catch up on next poll
    }

    return NextResponse.json({ cleared: streams.length });
  } catch (error) {
    console.error("Clear-all streams error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
