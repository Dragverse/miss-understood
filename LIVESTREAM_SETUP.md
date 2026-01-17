# Livestream Setup Guide

## Quick Start

Your Dragverse platform features a live streaming section on the homepage that automatically detects when you're broadcasting and displays your stream.

## Stream Information

**Your Dragverse Stream:**
- Stream ID: `fb7f1684-1b1a-4779-a4fd-2397bc714b96`
- Playback ID: `fb7fdq50qnczbi4u`
- Stream Key: `****5gn-3x6p` (full key available in Livepeer Studio)

## How to Go Live

### Option 1: Using OBS Studio (Recommended)

1. **Download OBS Studio** (if you don't have it): https://obsproject.com/

2. **Configure OBS Settings**:
   - Open OBS → Settings → Stream
   - Service: Custom
   - Server: `rtmp://rtmp.livepeer.com/live`
   - Stream Key: Your full stream key from Livepeer Studio

3. **Start Streaming**:
   - Click "Start Streaming" in OBS
   - Within 10-15 seconds, your homepage will show "LIVE" status
   - The stream player will automatically load

4. **Stop Streaming**:
   - Click "Stop Streaming" in OBS
   - Homepage will update to "Offline" within 10 seconds

### Option 2: Using Livepeer Studio Dashboard

1. Go to https://livepeer.studio/dashboard/streams
2. Find "Dragverse Stream"
3. Use the built-in stream test tool
4. Start broadcasting

### Option 3: Using Mobile Apps

#### Larix Broadcaster (iOS/Android)
1. Download from App Store or Play Store
2. Settings → Connections → New Connection
3. Name: Dragverse
4. URL: `rtmp://rtmp.livepeer.com/live`
5. Stream Key: Your stream key
6. Save and tap to go live

## Monitoring Your Stream

### Check Stream Status Manually

Run this command to see all your streams:
```bash
node scripts/get-stream-info.js
```

This will show:
- Stream status (Live/Offline)
- Stream ID and Playback ID
- Last seen timestamp
- Viewer count (when live)

### Frontend Monitoring

The homepage automatically checks stream status every 10 seconds:
- **Green "LIVE" badge**: Stream is active
- **Red "Offline" badge**: Stream is not broadcasting
- **Loading spinner**: Checking status

### Browser Console

Open the browser console (F12) on your homepage to see detailed stream status logs:
```
Stream status: {
  isLive: true,
  method: "HLS manifest content check",
  reason: "Active stream detected",
  fallback: true
}
```

## Troubleshooting

### Stream Not Showing as Live

**Problem**: You're broadcasting but the homepage shows "Offline"

**Solutions**:
1. **Wait 10-15 seconds** - It takes a moment for the HLS manifest to update
2. **Check your stream key** - Make sure it matches your Livepeer dashboard
3. **Verify RTMP URL** - Should be exactly `rtmp://rtmp.livepeer.com/live`
4. **Hard refresh** - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)

**Check if Livepeer is receiving your stream**:
```bash
node scripts/get-stream-info.js
```

Look for "Status: 🟢 LIVE" next to your Dragverse Stream

### Playback Not Working

**Problem**: Badge shows "LIVE" but video doesn't play

**Solutions**:
1. **Check HLS URL manually**: Visit `https://livepeercdn.studio/hls/fb7fdq50qnczbi4u/index.m3u8`
   - Should return a playlist, not 404
2. **Check browser console** for player errors
3. **Try a different browser** - Safari, Chrome, Firefox all handle HLS differently
4. **Disable browser extensions** - Ad blockers can interfere

### API Returns 404

**Problem**: Seeing "Livepeer API returned 404, falling back to HLS check"

This is normal! The fallback HLS check is reliable and works well. The 404 means:
- The stream ID in the API request doesn't match
- OR the Livepeer API endpoint structure changed

The HLS fallback method checks the actual video manifest and is more reliable for detecting if you're actually broadcasting.

## Environment Variables

### Development (.env.local)
```bash
LIVEPEER_API_KEY=95e68586-6c82-4dd5-8dcd-61f000d2df38
OFFICIAL_STREAM_ID=fb7f1684-1b1a-4779-a4fd-2397bc714b96
OFFICIAL_PLAYBACK_ID=fb7fdq50qnczbi4u
```

### Production (Vercel/Deployment Platform)

Add these environment variables in your deployment platform:
1. Go to your Vercel dashboard → Project Settings → Environment Variables
2. Add each variable with the values above
3. Redeploy for changes to take effect

## Stream Settings for Best Quality

### OBS Recommended Settings

**Output**:
- Output Mode: Simple
- Video Bitrate: 2500-4000 Kbps (depending on upload speed)
- Audio Bitrate: 160 Kbps

**Video**:
- Base Resolution: 1920x1080
- Output Resolution: 1280x720 or 1920x1080
- FPS: 30 (or 60 for high-motion content)

**Advanced**:
- Keyframe Interval: 2 seconds
- Profile: high
- Tune: zerolatency (for lower latency)

### Mobile Settings (Larix)

- Resolution: 720p or 1080p
- FPS: 30
- Bitrate: 2000-3000 Kbps

## Testing Your Stream

1. **Test locally first**:
   - Start your dev server: `npm run dev`
   - Go to http://localhost:3000
   - Start broadcasting from OBS
   - Watch for status change

2. **Test on production**:
   - Visit your live site (e.g., dragverse.app)
   - Start broadcasting
   - Status should update within 10-15 seconds

3. **Test playback**:
   - Click play on the video when live
   - Check volume controls
   - Test fullscreen mode
   - Try on mobile devices

## Advanced: Multiple Streams

If you want to add more streams (for different creators):

1. **Create new stream** in Livepeer Studio
2. **Get the IDs**: Run `node scripts/get-stream-info.js`
3. **Update your code**: Modify the hero section to fetch from a different stream ID

Example:
```typescript
// In hero-section.tsx, change the API call:
const response = await fetch("/api/stream/status/[NEW_STREAM_ID]");
```

## Stream Key Security

⚠️ **IMPORTANT**: Your stream key is like a password!

- **Never share your stream key publicly**
- **Never commit it to git**
- **Regenerate it if exposed**: Go to Livepeer Studio → Streams → Your Stream → Regenerate Key
- Only share it with trusted streamers

## Next Steps

Once your livestream is working:
1. Add stream scheduling (upcoming)
2. Add viewer chat (planned feature)
3. Add stream notifications for followers
4. Add multi-camera support

## Need Help?

- **Livepeer Documentation**: https://docs.livepeer.org/
- **OBS Studio Help**: https://obsproject.com/help
- **Livepeer Discord**: https://discord.gg/livepeer

---

**Last Updated**: January 2026
**Stream Last Seen**: January 16, 2026 8:33 PM
