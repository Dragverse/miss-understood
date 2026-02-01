import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const supabase = getSupabaseServerClient();

    // Check Bluesky connection - session has bluesky data if connected
    const hasBluesky = !!(session as any).bluesky?.did;

    // Check Farcaster connection - requires signer UUID in database
    let hasFarcaster = false;
    const userDid = (session as any).userDid;

    if (userDid) {
      const { data: creator } = await supabase
        .from("creators")
        .select("farcaster_signer_uuid")
        .eq("did", userDid)
        .single();

      hasFarcaster = !!creator?.farcaster_signer_uuid;
    }

    return NextResponse.json({
      bluesky: hasBluesky,
      farcaster: hasFarcaster,
    });
  } catch (error) {
    console.error("Failed to check platform connections:", error);
    return NextResponse.json(
      { bluesky: false, farcaster: false },
      { status: 200 }
    );
  }
}
