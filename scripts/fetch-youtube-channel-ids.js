#!/usr/bin/env node

/**
 * Automated YouTube Channel ID Fetcher
 *
 * This script fetches real YouTube channel IDs by scraping channel pages
 * and updates the channels.ts file automatically.
 *
 * Usage: node scripts/fetch-youtube-channel-ids.js
 */

const fs = require('fs');
const path = require('path');

// Channels that need real IDs (handle → expected channel name)
const CHANNELS_TO_FETCH = {
  // Makeup & Beauty
  'ellismiah': 'Ellis Miah',
  'trixiemattel': 'Trixie Mattel', // May use same ID, but verify
  'patrickstarrr': 'Patrick Starrr',
  'missvanjie': 'Vanessa Vanjie Mateo',
  'ravenbeautybar': 'Raven',

  // Additional Drag Performers
  'thevivienne': 'The Vivienne',
  'biminibabes': 'Bimini Bon-Boulash',
  'peppermint247': 'Peppermint',
  'brooklynnhytes': 'Brooke Lynn Hytes',
  'landonciider': 'Landon Cider',
  'thebouletbrothers': 'The Boulet Brothers',
  'victoriastone': 'Victoria Stone',
  'scarletenvy': 'Scarlet Envy',
  'crystalmethyd': 'Crystal Methyd',
  'evieoddly': 'Yvie Oddly',
  'sharonneedles': 'Sharon Needles',
  'courtneyact': 'Courtney Act',
  'latriceroyale': 'Latrice Royale',
  'heidincloset': 'Heidi N Closet',
  'kandyho': 'Kandy Ho',
  'dragulaofficial': 'Dragula Official',
};

/**
 * Fetch channel ID from YouTube handle using their public API/page scraping
 */
async function fetchChannelId(handle) {
  try {
    const url = `https://www.youtube.com/@${handle}`;
    console.log(`\n🔍 Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status} - Channel may not exist`);
      return null;
    }

    const html = await response.text();

    // Method 1: Find channelId in page source
    const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (channelIdMatch) {
      const channelId = channelIdMatch[1];
      console.log(`   ✅ Found: ${channelId}`);
      return channelId;
    }

    // Method 2: Find in externalId field
    const externalIdMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (externalIdMatch) {
      const channelId = externalIdMatch[1];
      console.log(`   ✅ Found (externalId): ${channelId}`);
      return channelId;
    }

    // Method 3: Find in browse_id
    const browseIdMatch = html.match(/browse_id["\s:]+([UC][a-zA-Z0-9_-]{22})/);
    if (browseIdMatch) {
      const channelId = browseIdMatch[1];
      console.log(`   ✅ Found (browse_id): ${channelId}`);
      return channelId;
    }

    console.log(`   ⚠️  Channel ID not found in page source`);
    return null;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test if a channel ID is valid by checking its RSS feed
 */
async function validateChannelId(channelId) {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetch(rssUrl);

    if (!response.ok) return false;

    const xml = await response.text();
    // Check if it's a valid feed (has entries or is proper XML)
    return xml.includes('<feed') && xml.length > 200;
  } catch (error) {
    return false;
  }
}

/**
 * Update the channels.ts file with real IDs
 */
function updateChannelsFile(channelIdMap) {
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'youtube', 'channels.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  let updatedCount = 0;

  // Update each channel
  for (const [handle, data] of Object.entries(channelIdMap)) {
    if (!data.channelId) continue;

    // Pattern to match the channel entry
    // Look for: channelId: "UC_NEED_REAL_ID_..." or "UCb7b7b7b..."
    const patterns = [
      // Pattern 1: UC_NEED_REAL_ID_* format
      new RegExp(`channelId:\\s*"UC_NEED_REAL_ID_[^"]+",\\s*\\/\\/[^\\n]*\\n(\\s*)handle:\\s*"${handle}"`, 'g'),
      // Pattern 2: Fake UCb7b7b7... format
      new RegExp(`channelId:\\s*"UC[b7]+[^"]*",\\s*\\n(\\s*)handle:\\s*"${handle}"`, 'g')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Replace with real ID and add verification comment
        content = content.replace(
          pattern,
          `channelId: "${data.channelId}", // ✅ Verified ${new Date().toISOString().split('T')[0]}\n$1handle: "${handle}"`
        );
        updatedCount++;
        console.log(`   📝 Updated ${handle} → ${data.channelId}`);
        break;
      }
    }
  }

  // Write back to file
  fs.writeFileSync(filePath, content, 'utf8');

  return updatedCount;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 YouTube Channel ID Fetcher');
  console.log('=====================================\n');
  console.log(`📋 Fetching IDs for ${Object.keys(CHANNELS_TO_FETCH).length} channels...\n`);

  const results = {};
  const delays = [1000, 1500, 2000, 1200, 1800]; // Varying delays to avoid rate limits

  for (const [handle, displayName] of Object.entries(CHANNELS_TO_FETCH)) {
    console.log(`\n🎭 ${displayName} (@${handle})`);

    // Fetch channel ID
    const channelId = await fetchChannelId(handle);

    if (channelId) {
      // Validate the ID
      console.log(`   🔄 Validating...`);
      const isValid = await validateChannelId(channelId);

      if (isValid) {
        console.log(`   ✅ Valid! RSS feed working`);
        results[handle] = { channelId, displayName, valid: true };
      } else {
        console.log(`   ⚠️  ID found but RSS feed failed`);
        results[handle] = { channelId, displayName, valid: false };
      }
    } else {
      console.log(`   ❌ Could not find channel ID`);
      results[handle] = { channelId: null, displayName, valid: false };
    }

    // Random delay between requests to avoid rate limiting
    const delay = delays[Math.floor(Math.random() * delays.length)];
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Summary
  console.log('\n\n=====================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('=====================================\n');

  const found = Object.values(results).filter(r => r.channelId !== null).length;
  const valid = Object.values(results).filter(r => r.valid).length;
  const failed = Object.keys(CHANNELS_TO_FETCH).length - found;

  console.log(`✅ Found: ${found}/${Object.keys(CHANNELS_TO_FETCH).length}`);
  console.log(`✅ Valid: ${valid}/${Object.keys(CHANNELS_TO_FETCH).length}`);
  console.log(`❌ Failed: ${failed}/${Object.keys(CHANNELS_TO_FETCH).length}\n`);

  // Show what was found
  console.log('📝 Channel IDs Found:\n');
  for (const [handle, data] of Object.entries(results)) {
    if (data.channelId) {
      const status = data.valid ? '✅' : '⚠️ ';
      console.log(`${status} @${handle.padEnd(20)} → ${data.channelId}`);
    } else {
      console.log(`❌ @${handle.padEnd(20)} → NOT FOUND`);
    }
  }

  // Update the file
  console.log('\n\n=====================================');
  console.log('💾 UPDATING channels.ts');
  console.log('=====================================\n');

  const validResults = Object.fromEntries(
    Object.entries(results).filter(([_, data]) => data.valid)
  );

  if (Object.keys(validResults).length > 0) {
    const updatedCount = updateChannelsFile(validResults);
    console.log(`\n✅ Updated ${updatedCount} channels in channels.ts`);
    console.log(`📁 File: src/lib/youtube/channels.ts\n`);
  } else {
    console.log('\n⚠️  No valid channel IDs to update\n');
  }

  // Manual follow-up needed
  const manualNeeded = Object.entries(results)
    .filter(([_, data]) => !data.valid)
    .map(([handle, data]) => ({ handle, ...data }));

  if (manualNeeded.length > 0) {
    console.log('\n=====================================');
    console.log('⚠️  MANUAL FOLLOW-UP NEEDED');
    console.log('=====================================\n');
    console.log('These channels need manual verification:\n');

    for (const { handle, displayName, channelId } of manualNeeded) {
      console.log(`🔍 ${displayName} (@${handle})`);
      if (channelId) {
        console.log(`   Found ID but RSS failed: ${channelId}`);
        console.log(`   Test: https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      } else {
        console.log(`   Channel not found - verify handle is correct`);
        console.log(`   Check: https://www.youtube.com/@${handle}`);
      }
      console.log('');
    }
  }

  console.log('=====================================');
  console.log('✨ DONE!');
  console.log('=====================================\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
