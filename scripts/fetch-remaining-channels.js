#!/usr/bin/env node

/**
 * Fetch remaining channel IDs with alternate handle attempts
 */

// Alternate handles to try
const ALTERNATE_HANDLES = {
  'trixiemattel': ['trixiemattel', 'TrixieMattelofficial'], // Already in main list, verify
  'missvanjie': ['vanjie', 'vanessamateo', 'missvanjie'],
  'ravenbeautybar': ['raven', 'ravensimone', 'itsmisraven'],
  'thevivienne': ['thevivienneuk', 'vivienne'],
  'peppermint247': ['peppermint', 'misspeppermint', 'peppermintofficial'],
  'brooklynnhytes': ['bhytes', 'brookelynnhytes', 'brookelynn'],
  'landonciider': ['landoncider', 'landonciderofficial'],
  'thebouletbrothers': ['bouletbrothers', 'bouletbrothersdragula', 'dragula'],
  'dragulaofficial': ['bouletbrothersdragula', 'dragula'],
};

// Known channel IDs from research
const KNOWN_IDS = {
  'peppermint247': 'UC5t6alAyno_ehV_XvGSkjAg', // Found via web search
  'trixiemattel': 'UC_gYMGjaNE8xvgb-fE1lZoA', // Already in working channels
};

async function fetchChannelId(handle) {
  try {
    const url = `https://www.youtube.com/@${handle}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/"(?:channelId|externalId)":"(UC[a-zA-Z0-9_-]{22})"/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('🔍 Searching for remaining channels with alternate handles...\n');

  const results = {};

  // Try known IDs first
  for (const [handle, channelId] of Object.entries(KNOWN_IDS)) {
    console.log(`✅ ${handle}: ${channelId} (known)`);
    results[handle] = channelId;
  }

  // Try alternate handles
  for (const [originalHandle, alternates] of Object.entries(ALTERNATE_HANDLES)) {
    if (results[originalHandle]) continue; // Skip if already found

    console.log(`\n🔍 Trying alternates for ${originalHandle}:`);

    for (const altHandle of alternates) {
      console.log(`   Testing: @${altHandle}`);
      const channelId = await fetchChannelId(altHandle);

      if (channelId) {
        console.log(`   ✅ Found: ${channelId}`);
        results[originalHandle] = channelId;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (!results[originalHandle]) {
      console.log(`   ❌ No channel found for ${originalHandle}`);
    }
  }

  console.log('\n\n📊 RESULTS:\n');
  for (const [handle, channelId] of Object.entries(results)) {
    console.log(`${handle}: ${channelId}`);
  }

  console.log(`\n✅ Found ${Object.keys(results).length} additional channels`);
}

main().catch(console.error);
