/**
 * Fix incomplete Livepeer playback URLs in database
 * This script appends /index.m3u8 to all playback_url values that are missing it
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local manually
try {
  const envPath = join(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (error) {
  console.warn('Could not load .env.local, using existing environment variables');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPlaybackUrls() {
  console.log('🔍 Finding videos with incomplete playback URLs...\n');

  // Find videos that need fixing
  const { data: videosToFix, error: selectError } = await supabase
    .from('videos')
    .select('id, title, playback_url')
    .not('playback_url', 'is', null)
    .neq('playback_url', '')
    .not('playback_url', 'like', '%/index.m3u8')
    .not('playback_url', 'like', '%.m3u8');

  if (selectError) {
    console.error('❌ Error fetching videos:', selectError);
    process.exit(1);
  }

  if (!videosToFix || videosToFix.length === 0) {
    console.log('✅ All playback URLs are already complete! No fixes needed.');
    return;
  }

  console.log(`Found ${videosToFix.length} videos with incomplete URLs:\n`);
  videosToFix.forEach((v, i) => {
    console.log(`${i + 1}. "${v.title}"`);
    console.log(`   BEFORE: ${v.playback_url}`);
    console.log(`   AFTER:  ${v.playback_url}/index.m3u8\n`);
  });

  console.log('🔧 Fixing URLs...\n');

  // Fix each video
  let successCount = 0;
  let errorCount = 0;

  for (const video of videosToFix) {
    const newUrl = `${video.playback_url}/index.m3u8`;

    const { error: updateError } = await supabase
      .from('videos')
      .update({ playback_url: newUrl })
      .eq('id', video.id);

    if (updateError) {
      console.error(`❌ Failed to update "${video.title}":`, updateError);
      errorCount++;
    } else {
      console.log(`✅ Fixed: "${video.title}"`);
      successCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully fixed: ${successCount} videos`);
  if (errorCount > 0) {
    console.log(`❌ Failed to fix: ${errorCount} videos`);
  }

  // Verify the fixes
  console.log('\n🔍 Verifying fixes...\n');

  const { data: verifyData, error: verifyError } = await supabase
    .from('videos')
    .select('id, title, playback_url')
    .not('playback_url', 'is', null)
    .neq('playback_url', '')
    .limit(5);

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError);
  } else if (verifyData) {
    console.log('Sample of fixed URLs:');
    verifyData.forEach((v, i) => {
      console.log(`${i + 1}. "${v.title}"`);
      console.log(`   URL: ${v.playback_url}\n`);
    });
  }

  console.log('✨ Done! All playback URLs have been fixed.');
  console.log('🚀 Your videos should now play correctly on https://www.dragverse.app/snapshots');
}

// Run the script
fixPlaybackUrls().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
