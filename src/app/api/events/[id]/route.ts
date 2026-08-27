import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { validateBody } from "@/lib/validation/schemas";
import { eventUpdateSchema, eventInputToRow, rowToEvent, type EventRow } from "@/lib/events/types";
import { geocodeVenue } from "@/lib/events/geocode";

export const dynamic = "force-dynamic";

async function requireOwner(request: NextRequest, eventId: string) {
  if (!isPrivyConfigured()) {
    return { error: NextResponse.json({ error: "Authentication not configured" }, { status: 500 }) };
  }

  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, creator_did")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  }
  if (data.creator_did !== auth.userId) {
    return {
      error: NextResponse.json({ error: "You don't have permission to edit this event" }, { status: 403 }),
    };
  }

  return { creatorDid: auth.userId };
}

/** PUT /api/events/[id] — replace an event's details. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await requireOwner(request, id);
    if ("error" in guard) return guard.error;

    const parsed = validateBody(eventUpdateSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Re-geocode on update: the venue may have changed, and stale coordinates
    // would put the pin somewhere the event isn't.
    const row = eventInputToRow(parsed.data, guard.creatorDid);
    const coords = await geocodeVenue(parsed.data);
    Object.assign(row, coords ?? { latitude: null, longitude: null });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Events] Update failed:", error);
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: rowToEvent(data as EventRow) });
  } catch (error) {
    console.error("[Events] Update error:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

/**
 * DELETE /api/events/[id]
 *
 * `?cancel=true` marks it cancelled instead of removing it, so people who
 * already have the date know it's off rather than finding it silently gone.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await requireOwner(request, id);
    if ("error" in guard) return guard.error;

    const cancelOnly = new URL(request.url).searchParams.get("cancel") === "true";
    const supabase = getSupabaseServerClient();

    const { error } = cancelOnly
      ? await supabase.from("events").update({ cancelled_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("events").delete().eq("id", id);

    if (error) {
      console.error("[Events] Delete failed:", error);
      return NextResponse.json({ error: "Failed to remove event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, cancelled: cancelOnly });
  } catch (error) {
    console.error("[Events] Delete error:", error);
    return NextResponse.json({ error: "Failed to remove event" }, { status: 500 });
  }
}
