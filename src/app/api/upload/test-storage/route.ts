import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * Diagnostic endpoint to test Supabase Storage access
 * This will help us see the exact error message
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    console.log("[TestStorage] Testing Supabase Storage access...");

    // Test 1: List buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error("[TestStorage] Failed to list buckets:", bucketsError);
      return NextResponse.json({
        success: false,
        test: "list_buckets",
        error: bucketsError.message,
        details: bucketsError
      });
    }

    console.log("[TestStorage] Available buckets:", buckets?.map(b => b.name));

    // Test 2: Check if 'media' bucket exists
    const mediaBucket = buckets?.find(b => b.name === 'media');
    if (!mediaBucket) {
      return NextResponse.json({
        success: false,
        test: "check_media_bucket",
        error: "Bucket 'media' not found",
        availableBuckets: buckets?.map(b => b.name) || []
      });
    }

    console.log("[TestStorage] Media bucket found:", mediaBucket);

    // Test 3: Try to list files in media bucket
    const { data: files, error: listError } = await supabase.storage
      .from('media')
      .list('images', { limit: 5 });

    if (listError) {
      console.error("[TestStorage] Failed to list files:", listError);
      return NextResponse.json({
        success: false,
        test: "list_files",
        error: listError.message,
        details: listError
      });
    }

    console.log("[TestStorage] Files in media/images:", files?.length || 0);

    // Test 4: Try to upload a small test file
    const testContent = new TextEncoder().encode("test file");
    const testPath = `images/test-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      console.error("[TestStorage] Upload test failed:", uploadError);
      return NextResponse.json({
        success: false,
        test: "test_upload",
        error: uploadError.message,
        details: uploadError,
        bucketExists: true,
        bucketInfo: mediaBucket
      });
    }

    console.log("[TestStorage] Test upload successful:", uploadData);

    // Clean up test file
    await supabase.storage.from('media').remove([testPath]);

    return NextResponse.json({
      success: true,
      message: "All storage tests passed!",
      bucketInfo: mediaBucket,
      testsCompleted: [
        "list_buckets",
        "check_media_bucket",
        "list_files",
        "test_upload"
      ]
    });

  } catch (error) {
    console.error("[TestStorage] Unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
