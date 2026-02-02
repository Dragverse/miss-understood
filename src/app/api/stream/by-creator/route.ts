import { NextRequest, NextResponse } from "next/server";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

/**
 * GET /api/stream/by-creator?creatorDID={did}
 * Fetches active streams for a specific creator
 *
 * Note: This is a placeholder implementation. Once we implement stream management
 * in the database (storing stream metadata including creatorDID), we'll query
 * Supabase instead of Livepeer directly.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creatorDID = searchParams.get("creatorDID");

    if (!creatorDID) {
      return NextResponse.json(
        { error: "creatorDID parameter is required" },
        { status: 400 }
      );
    }

    // TODO: In the future, query Supabase for streams associated with this creator
    // For now, return empty array since we don't have a streams table yet
    // Example future implementation:
    // const { data: streams } = await supabase
    //   .from("streams")
    //   .select("*")
    //   .eq("creator_did", creatorDID)
    //   .eq("is_active", true);

    return NextResponse.json({
      streams: [],
      message: "Stream management database not yet implemented",
    });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
