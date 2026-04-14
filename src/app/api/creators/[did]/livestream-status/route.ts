import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * GET /api/creators/[did]/livestream-status
 *
 * Returns whether a creator has been approved for livestreaming.
 * Used by the feed sidebar to show/hide the "Go Live" shortcut.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ did: string }> }
) {
  try {
    const { did } = await params;

    if (!did) {
      return NextResponse.json({ approved: false });
    }

    const supabase = getSupabaseServerClient();

    const { data: creator, error } = await supabase
      .from("creators")
      .select("did")
      .eq("did", did)
      .maybeSingle();

    if (error || !creator) {
      return NextResponse.json({ approved: false });
    }

    // Check for an optional can_livestream column — fall back to false if missing
    const approved = (creator as any).can_livestream ?? false;

    return NextResponse.json(
      { approved },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[livestream-status] Error:", error);
    return NextResponse.json({ approved: false });
  }
}
