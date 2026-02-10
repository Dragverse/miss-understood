/**
 * Check playback URLs in database
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
  console.warn('Could not load .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUrls() {
  console.log('🔍 Checking playback URLs in database...\n');

  // Get all videos
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, playback_url, playback_id, content_type')
    .eq('content_type', 'short')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log('No videos found');
    return;
  }

  console.log(`Found ${videos.length} short videos:\n`);

  videos.forEach((v, i) => {
    console.log(`${i + 1}. "${v.title}"`);
    console.log(`   ID: ${v.id}`);
    console.log(`   playback_url: ${v.playback_url || '(empty)'}`);
    console.log(`   playback_id: ${v.playback_id || '(empty)'}`);
    console.log(`   content_type: ${v.content_type}`);

    // Check if URL is complete
    if (v.playback_url) {
      const isComplete = v.playback_url.endsWith('/index.m3u8') || v.playback_url.endsWith('.m3u8');
      console.log(`   Status: ${isComplete ? '✅ Complete' : '❌ Incomplete - needs /index.m3u8'}`);
    } else {
      console.log(`   Status: ⚠️ No playback_url - would construct from playback_id`);
    }
    console.log('');
  });
}

checkUrls().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
