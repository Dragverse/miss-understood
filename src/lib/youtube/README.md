# YouTube Integration

## Current Status

### RSS Feeds (Currently Not Working ❌)
YouTube RSS feeds are returning 404 errors for all tested channels:
- Format tested: `https://www.youtube.com/feeds/videos.xml?channel_id={channelId}`
- All 10 curated drag channels return 404
- Likely YouTube has deprecated or restricted RSS access

### YouTube Data API (Working ✅)
The YouTube Data API v3 integration works but has quota limits:
- Daily quota: 10,000 units
- Each search costs ~100 units = ~100 searches/day
- Caching reduces usage by 10x (1-hour cache)

## Solutions

### Option 1: Use YouTube Data API (Recommended)
1. Get a YouTube Data API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Add to `.env.local`:
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```
3. API will automatically be used when key is present

### Option 2: Focus on Dragverse Content
- Upload shorts directly to Dragverse (no external dependencies)
- Best quality control and authentic content
- No API quotas or rate limits

### Option 3: Manual RSS Feed Verification
If YouTube RSS feeds start working again:
1. Manually verify each channel's RSS feed
2. Update channel IDs in `channels.ts`
3. Test with: `curl https://www.youtube.com/feeds/videos.xml?channel_id={ID}`

## Curated Channels

Current list of 10 drag-related channels in `channels.ts`:
1. RuPaul's Drag Race
2. WOW Presents
3. Trixie Mattel
4. Katya Zamolodchikova
5. Bob The Drag Queen
6. Bianca Del Rio
7. Gottmik
8. Kim Chi
9. Shangela
10. Aquaria

## API Endpoints

- `/api/youtube/feed` - Fetch YouTube videos
  - `?limit=20` - Number of videos
  - `?shortsOnly=true` - Only return shorts
  - `?sortBy=recent|engagement` - Sort order

## Caching Strategy

Videos are cached for 1 hour to reduce API quota usage:
- Cache key: `youtube-feed-{limit}` or `youtube-shorts-{limit}`
- Location: In-memory cache (resets on server restart)
- TTL: 3600 seconds (1 hour)
