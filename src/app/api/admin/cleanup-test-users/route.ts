import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * DELETE /api/admin/cleanup-test-users
 * Remove test users from the database
 * Only keeps real Privy users (DIDs starting with "did:privy:")
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get all creators
    const { data: allCreators, error: fetchError } = await supabase
      .from("creators")
      .select("id, did, handle, display_name, created_at");

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch creators",
        details: fetchError.message,
      });
    }

    // Identify test users (DIDs that don't start with "did:privy:" or "did:key:")
    const testUsers = allCreators?.filter(
      (c) => !c.did.startsWith("did:privy:") && !c.did.startsWith("did:key:")
    ) || [];

    const realUsers = allCreators?.filter(
      (c) => c.did.startsWith("did:privy:") || c.did.startsWith("did:key:")
    ) || [];

    console.log(`[Cleanup] Found ${testUsers.length} test users and ${realUsers.length} real users`);

    if (testUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No test users to clean up",
        summary: {
          testUsersFound: 0,
          testUsersDeleted: 0,
          realUsersKept: realUsers.length,
        },
        realUsers: realUsers.map(u => ({
          did: u.did,
          handle: u.handle,
          displayName: u.display_name,
        })),
      });
    }

    // Delete test users
    const testUserIds = testUsers.map((u) => u.id);

    console.log(`[Cleanup] Deleting test users:`, testUsers.map(u => ({
      did: u.did,
      handle: u.handle,
    })));

    const { error: deleteError } = await supabase
      .from("creators")
      .delete()
      .in("id", testUserIds);

    if (deleteError) {
      console.error("[Cleanup] Failed to delete test users:", deleteError);
      return NextResponse.json({
        success: false,
        error: "Failed to delete test users",
        details: deleteError.message,
        testUsers: testUsers.map(u => ({
          id: u.id,
          did: u.did,
          handle: u.handle,
        })),
      });
    }

    console.log(`[Cleanup] Successfully deleted ${testUsers.length} test users`);

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${testUsers.length} test users`,
      summary: {
        testUsersFound: testUsers.length,
        testUsersDeleted: testUsers.length,
        realUsersKept: realUsers.length,
      },
      deletedUsers: testUsers.map((u) => ({
        did: u.did,
        handle: u.handle,
        displayName: u.display_name,
      })),
      realUsers: realUsers.map((u) => ({
        did: u.did,
        handle: u.handle,
        displayName: u.display_name,
      })),
    });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/admin/cleanup-test-users
 * Preview which users would be deleted (dry run)
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    // Get all creators
    const { data: allCreators, error: fetchError } = await supabase
      .from("creators")
      .select("id, did, handle, display_name, created_at");

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch creators",
        details: fetchError.message,
      });
    }

    // Identify test users
    const testUsers = allCreators?.filter(
      (c) => !c.did.startsWith("did:privy:") && !c.did.startsWith("did:key:")
    ) || [];

    const realUsers = allCreators?.filter(
      (c) => c.did.startsWith("did:privy:") || c.did.startsWith("did:key:")
    ) || [];

    return NextResponse.json({
      success: true,
      message: "Preview of cleanup operation (dry run)",
      summary: {
        totalCreators: allCreators?.length || 0,
        testUsersToDelete: testUsers.length,
        realUsersToKeep: realUsers.length,
      },
      testUsers: testUsers.map((u) => ({
        id: u.id,
        did: u.did,
        handle: u.handle,
        displayName: u.display_name,
        createdAt: u.created_at,
      })),
      realUsers: realUsers.map((u) => ({
        did: u.did,
        handle: u.handle,
        displayName: u.display_name,
        createdAt: u.created_at,
      })),
      note: "Use DELETE method to actually remove test users",
    });
  } catch (error) {
    console.error("[Cleanup Preview] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
