import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { getCreatorByDID, getCreatorByHandleOrDID } from "@/lib/supabase/creators";
import { validateBody } from "@/lib/validation/schemas";
import { eventInputSchema, eventInputToRow, rowToEvent, type EventRow } from "@/lib/events/types";

export const dynamic = "force-dynamic";

/**
 * True when the failure is "the events table doesn't exist" rather than a real
 * query error. PostgREST reports this as PGRST205, Postgres as 42P01.
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table/i.test(error.message ?? "")
  );
}

/**
 * GET /api/events?handle=…&upcoming=true&limit=…
 *
 * A creator's events, or — with no handle — everything public and upcoming,
 * optionally narrowed by city for discovery.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");
    const city = searchParams.get("city");
    const includePast = searchParams.get("includePast") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

    const supabase = getSupabaseServerClient();
    let query = supabase.from("events").select("*").is("cancelled_at", null);

    if (handle) {
      const creator = await getCreatorByHandleOrDID(handle);
      if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
      query = query.eq("creator_did", creator.did);
    } else {
      // Discovery only ever shows public events.
      query = query.eq("visibility", "public");
    }

    if (city) query = query.ilike("city", city);

    if (!includePast) {
      // Compare against the end where there is one, so an event that is
      // currently happening doesn't vanish the moment it starts.
      query = query.or(`ends_at.gte.${new Date().toISOString()},and(ends_at.is.null,starts_at.gte.${new Date(Date.now() - 6 * 3600_000).toISOString()})`);
    }

    const { data, error } = await query.order("starts_at", { ascending: true }).limit(limit);

    if (error) {
      // The `upcoming` block is on every board, so a missing events table
      // would otherwise log a 500 on every profile view. Not-provisioned is
      // not an error: report it as an empty list and let the caller say so.
      if (isMissingTable(error)) {
        return NextResponse.json({ success: true, events: [], provisioned: false });
      }
      console.error("[Events] List failed:", error);
      return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      provisioned: true,
      events: ((data ?? []) as EventRow[]).map(rowToEvent),
    });
  } catch (error) {
    console.error("[Events] List error:", error);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

/**
 * POST /api/events — create an event on the authenticated creator's board.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const parsed = validateBody(eventInputSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const creator = await getCreatorByDID(auth.userId);
    if (!creator) {
      return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .insert(eventInputToRow(parsed.data, auth.userId, creator.id))
      .select()
      .single();

    if (error) {
      console.error("[Events] Create failed:", error);
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: rowToEvent(data as EventRow) });
  } catch (error) {
    console.error("[Events] Create error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
