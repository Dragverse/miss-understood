import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY!;

interface LivepeerAsset {
  id: string;
  playbackId: string;
  downloadUrl?: string;
  status: {
    phase: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Fix Audio URLs] Starting migration...");

    // Get all audio files
    const { data: audioRecords, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, content_type, playback_id, livepeer_asset_id, playback_url')
      .in('content_type', ['podcast', 'music']);

    if (fetchError) {
      console.error("[Fix Audio URLs] Error fetching audio records:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!audioRecords || audioRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No audio records found",
        updated: 0
      });
    }

    console.log(`[Fix Audio URLs] Found ${audioRecords.length} audio records`);

    const results = {
      total: audioRecords.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each audio record
    for (const record of audioRecords) {
      const assetId = record.livepeer_asset_id || record.playback_id;

      if (!assetId) {
        console.log(`[Fix Audio URLs] Skipping ${record.id} - no asset ID`);
        results.skipped++;
        continue;
      }

      try {
        // Query Livepeer API for asset details
        console.log(`[Fix Audio URLs] Querying Livepeer for asset ${assetId}...`);
        const livepeerResponse = await fetch(
          `https://livepeer.studio/api/asset/${assetId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!livepeerResponse.ok) {
          const errorText = await livepeerResponse.text();
          console.error(`[Fix Audio URLs] Livepeer API error for ${assetId}:`, errorText);
          results.failed++;
          results.errors.push(`${record.title}: Livepeer API error (${livepeerResponse.status})`);
          continue;
        }

        const asset: LivepeerAsset = await livepeerResponse.json();

        // Get download URL from Livepeer response
        let downloadUrl = asset.downloadUrl;

        // If no downloadUrl, construct it from asset UUID (not playbackId)
        if (!downloadUrl && asset.id) {
          downloadUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${asset.playbackId}/video`;
        }

        if (!downloadUrl) {
          console.warn(`[Fix Audio URLs] No download URL for ${assetId}`);
          results.failed++;
          results.errors.push(`${record.title}: No download URL available`);
          continue;
        }

        console.log(`[Fix Audio URLs] Found URL for ${record.title}: ${downloadUrl}`);

        // Update database
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            playback_url: downloadUrl,
            playback_id: asset.playbackId || record.playback_id,
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`[Fix Audio URLs] Error updating ${record.id}:`, updateError);
          results.failed++;
          results.errors.push(`${record.title}: Database update failed`);
          continue;
        }

        results.updated++;
        console.log(`[Fix Audio URLs] ✅ Updated ${record.title}`);

      } catch (error) {
        console.error(`[Fix Audio URLs] Error processing ${record.id}:`, error);
        results.failed++;
        results.errors.push(`${record.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log("[Fix Audio URLs] Migration complete:", results);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} of ${results.total} audio files`,
      ...results,
    });

  } catch (error) {
    console.error("[Fix Audio URLs] Fatal error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false
      },
      { status: 500 }
    );
  }
}
