import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

/**
 * POST /api/admin/migrate-audio-urls
 *
 * Migration script to fix audio playback URLs for existing audio files.
 * Constructs downloadUrl from Livepeer asset IDs for audio content.
 *
 * Security: Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("[Audio Migration] Starting migration for user:", auth.userId);

    const supabase = getSupabaseServerClient();

    // Step 1: Find all audio content with missing or invalid playback URLs
    const { data: audioRecords, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, content_type, playback_url, playback_id, livepeer_asset_id')
      .in('content_type', ['podcast', 'music'])
      .or('playback_url.is.null,playback_url.eq.');

    if (fetchError) {
      console.error("[Audio Migration] Failed to fetch audio records:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch audio records", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!audioRecords || audioRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No audio records need migration",
        updated: 0,
        skipped: 0,
      });
    }

    console.log(`[Audio Migration] Found ${audioRecords.length} audio records to check`);

    let updated = 0;
    let skipped = 0;
    const errors: Array<{ id: string; title: string; error: string }> = [];

    // Step 2: Process each audio record
    for (const record of audioRecords) {
      const assetId = record.playback_id || record.livepeer_asset_id;

      if (!assetId) {
        console.warn(`[Audio Migration] Skipping ${record.id} (${record.title}) - no asset ID`);
        skipped++;
        errors.push({
          id: record.id,
          title: record.title,
          error: "No Livepeer asset ID found",
        });
        continue;
      }

      // Construct downloadUrl from Livepeer asset ID
      // Livepeer downloadUrl format: https://livepeercdn.studio/asset/{assetId}/original
      const downloadUrl = `https://livepeercdn.studio/asset/${assetId}/original`;

      console.log(`[Audio Migration] Updating ${record.id} (${record.title})`);
      console.log(`[Audio Migration] Setting playback_url to: ${downloadUrl}`);

      // Update the database
      const { error: updateError } = await supabase
        .from('videos')
        .update({ playback_url: downloadUrl })
        .eq('id', record.id);

      if (updateError) {
        console.error(`[Audio Migration] Failed to update ${record.id}:`, updateError);
        errors.push({
          id: record.id,
          title: record.title,
          error: updateError.message,
        });
        skipped++;
      } else {
        console.log(`[Audio Migration] ✅ Updated ${record.id}`);
        updated++;
      }
    }

    console.log(`[Audio Migration] Complete: ${updated} updated, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${updated} audio records updated`,
      updated,
      skipped,
      total: audioRecords.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("[Audio Migration] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
