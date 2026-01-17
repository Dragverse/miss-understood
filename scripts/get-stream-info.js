#!/usr/bin/env node
/**
 * Get all Livepeer streams to find the correct stream ID and playback ID
 * Run with: node scripts/get-stream-info.js
 */

const fs = require('fs');
const path = require('path');

// Try to read from .env.local
let LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;

if (!LIVEPEER_API_KEY) {
  try {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/LIVEPEER_API_KEY=(.+)/);
    if (match) {
      LIVEPEER_API_KEY = match[1].trim();
    }
  } catch (error) {
    // .env.local not found or unreadable
  }
}

if (!LIVEPEER_API_KEY) {
  console.error('❌ LIVEPEER_API_KEY not found in environment');
  console.log('\nPlease set your Livepeer API key:');
  console.log('export LIVEPEER_API_KEY=your_api_key_here');
  process.exit(1);
}

async function getStreams() {
  try {
    console.log('🔍 Fetching streams from Livepeer Studio...\n');

    const response = await fetch('https://livepeer.studio/api/stream', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const streams = await response.json();

    if (!streams || streams.length === 0) {
      console.log('❌ No streams found in your Livepeer Studio account');
      console.log('\nTo create a stream:');
      console.log('1. Go to https://livepeer.studio/dashboard/streams');
      console.log('2. Click "Create Stream"');
      console.log('3. Copy the Stream ID and Playback ID');
      return;
    }

    console.log(`✅ Found ${streams.length} stream(s):\n`);

    streams.forEach((stream, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Stream #${index + 1}: ${stream.name || 'Unnamed'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Stream ID:     ${stream.id}`);
      console.log(`Playback ID:   ${stream.playbackId}`);
      console.log(`Status:        ${stream.isActive ? '🟢 LIVE' : '🔴 Offline'}`);
      console.log(`Created:       ${new Date(stream.createdAt).toLocaleString()}`);
      if (stream.lastSeen) {
        console.log(`Last Seen:     ${new Date(stream.lastSeen).toLocaleString()}`);
      }
      console.log(`\nStream Key:    ${stream.streamKey ? '****' + stream.streamKey.slice(-8) : 'N/A'}`);
      console.log(`RTMP URL:      rtmp://rtmp.livepeer.com/live`);
      console.log(`HLS URL:       https://livepeercdn.studio/hls/${stream.playbackId}/index.m3u8`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 To use a stream in your app:\n');
    console.log('Add these to your .env.local file:');
    console.log('');

    const mainStream = streams[0];
    console.log(`OFFICIAL_STREAM_ID=${mainStream.id}`);
    console.log(`OFFICIAL_PLAYBACK_ID=${mainStream.playbackId}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error fetching streams:', error.message);
    process.exit(1);
  }
}

getStreams();
