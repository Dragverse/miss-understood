import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stream/live-creators
 * Returns a lightweight list of creator DIDs that are currently active.
 * Used for live aura on avatars across the app — polled every 30s.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("streams")
      .select("creator_did")
      .eq("is_active", true);

    if (error) {
      if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
        return NextResponse.json({ dids: [] });
      }
      return NextResponse.json({ dids: [] });
    }

    const dids = (data ?? []).map((r) => r.creator_did).filter(Boolean);
    return NextResponse.json({ dids });
  } catch {
    return NextResponse.json({ dids: [] });
  }
}
