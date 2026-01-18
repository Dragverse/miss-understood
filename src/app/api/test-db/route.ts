import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { createOrUpdateCreator } from "@/lib/supabase/creators";

/**
 * GET /api/test-db
 * Test database connection and operations
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  try {
    // Test 1: Check Supabase connection
    results.tests.push({ name: "Supabase connection", status: "testing" });
    const client = getSupabaseServerClient();
    results.tests[0].status = "✅ Connected";
    results.tests[0].client = "Server client initialized";

    // Test 2: Query creators table
    results.tests.push({ name: "Query creators table", status: "testing" });
    const { data: creators, error: creatorsError } = await client
      .from("creators")
      .select("*")
      .limit(5);

    if (creatorsError) {
      results.tests[1].status = "❌ Failed";
      results.tests[1].error = creatorsError;
    } else {
      results.tests[1].status = "✅ Success";
      results.tests[1].count = creators?.length || 0;
      results.tests[1].sample = creators?.slice(0, 2);
    }

    // Test 3: Create test creator
    results.tests.push({ name: "Create test creator", status: "testing" });
    try {
      const testCreator = await createOrUpdateCreator({
        did: `test-${Date.now()}`,
        handle: `test-${Date.now()}`,
        display_name: "Test Creator",
        avatar: "",
        description: "Test",
      });
      results.tests[2].status = "✅ Success";
      results.tests[2].creatorId = testCreator.id;
    } catch (error) {
      results.tests[2].status = "❌ Failed";
      results.tests[2].error = error instanceof Error ? error.message : String(error);
      results.tests[2].details = error;
    }

    // Test 4: Query videos table
    results.tests.push({ name: "Query videos table", status: "testing" });
    const { data: videos, error: videosError } = await client
      .from("videos")
      .select("*")
      .limit(5);

    if (videosError) {
      results.tests[3].status = "❌ Failed";
      results.tests[3].error = videosError;
    } else {
      results.tests[3].status = "✅ Success";
      results.tests[3].count = videos?.length || 0;
      results.tests[3].sample = videos?.slice(0, 2);
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      ...results,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
