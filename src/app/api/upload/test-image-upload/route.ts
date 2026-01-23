import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * Test endpoint to simulate the exact image upload flow
 * This will help us diagnose the thumbnail upload issue
 */
export async function POST(request: NextRequest) {
  const logs: string[] = [];

  try {
    logs.push("Step 1: Starting image upload test");

    // Test authentication (same as image-v2)
    logs.push(`Step 2: Checking if Privy is configured: ${isPrivyConfigured()}`);

    if (isPrivyConfigured()) {
      logs.push("Step 3: Verifying authentication...");
      const auth = await verifyAuth(request);
      logs.push(`Step 4: Auth result - authenticated: ${auth.authenticated}, userId: ${auth.userId}, error: ${auth.error}`);

      if (!auth.authenticated) {
        return NextResponse.json({
          success: false,
          step: "authentication",
          error: "Authentication failed",
          authError: auth.error,
          logs
        });
      }
    } else {
      logs.push("Step 3: Privy not configured - skipping auth");
    }

    // Test Supabase client creation
    logs.push("Step 5: Creating Supabase server client...");
    const supabase = getSupabaseServerClient();
    logs.push("Step 6: Supabase client created successfully");

    // Test bucket access
    logs.push("Step 7: Testing access to 'media' bucket...");
    const { data: listData, error: listError } = await supabase.storage
      .from('media')
      .list('images', { limit: 1 });

    if (listError) {
      logs.push(`Step 8: Failed to list files - Error: ${listError.message}`);
      return NextResponse.json({
        success: false,
        step: "bucket_access",
        error: listError.message,
        details: listError,
        logs
      });
    }

    logs.push(`Step 8: Successfully listed files in bucket (count: ${listData?.length || 0})`);

    // Test file upload with a small test file
    logs.push("Step 9: Testing file upload...");
    const testContent = new TextEncoder().encode("test image upload");
    const testPath = `images/test-auth-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logs.push(`Step 10: Upload failed - Error: ${uploadError.message}`);
      return NextResponse.json({
        success: false,
        step: "upload",
        error: uploadError.message,
        details: uploadError,
        logs
      });
    }

    logs.push(`Step 10: Upload successful - Path: ${uploadData.path}`);

    // Test getting public URL
    logs.push("Step 11: Getting public URL...");
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(testPath);

    logs.push(`Step 12: Public URL obtained: ${publicUrl}`);

    // Clean up test file
    logs.push("Step 13: Cleaning up test file...");
    await supabase.storage.from('media').remove([testPath]);
    logs.push("Step 14: Test file removed");

    return NextResponse.json({
      success: true,
      message: "All steps completed successfully - image upload should work!",
      publicUrl,
      logs
    });

  } catch (error) {
    logs.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({
      success: false,
      step: "unexpected_error",
      error: error instanceof Error ? error.message : String(error),
      logs
    }, { status: 500 });
  }
}
