# Bluesky Content Integration

This document explains how Dragverse integrates with Bluesky to populate the feed with drag-related content.

## Overview

To solve the "empty feed" problem for a new platform, Dragverse automatically fetches videos from Bluesky tagged with drag-related hashtags. This provides instant content while you build your user base.

## How It Works

### 1. Content Fetching

The platform searches Bluesky for posts with these hashtags:
- `#drag`
- `#dragqueen`
- `#dragrace`
- `#dragart`
- `#dragperformance`
- `#dragshow`
- `#dragmakeup`

### 2. Video Detection

Only posts with video content are included:
- Direct Bluesky video embeds
- External video links (YouTube, Vimeo, TikTok)

### 3. Feed Integration

Bluesky videos appear alongside Ceramic videos on the homepage:
- Sorted by date (newest first)
- Identified with a Bluesky badge in the top-right corner
- Clicking opens the original Bluesky post in a new tab

## API Endpoints

### GET /api/bluesky/feed

Fetches drag-related content from Bluesky.

**Query Parameters:**
- `limit` (optional): Number of videos to fetch (default: 50)
- `source` (optional): "search" or "accounts" (default: "search")

**Response:**
```json
{
  "success": true,
  "videos": [...],
  "count": 30,
  "source": "bluesky"
}
```

## Customization

### Adding Known Drag Queen Accounts

Edit `/src/app/api/bluesky/feed/route.ts` and add Bluesky handles to the `dragAccounts` array:

```typescript
const dragAccounts = [
  "bobthedraqueen.bsky.social",
  "willam.bsky.social",
  "katya.bsky.social",
  // Add more handles here
];
```

Then fetch from accounts instead of search:
```
GET /api/bluesky/feed?source=accounts
```

### Changing Search Terms

Edit `/src/lib/bluesky/client.ts` and modify the `searchTerms` array in `searchDragContent()`:

```typescript
const searchTerms = [
  "#drag",
  "#dragqueen",
  "#dragrace",
  // Add your custom tags here
];
```

## Video Card Display

Bluesky videos are displayed with:
- **Blue badge** in top-right corner showing Bluesky icon + external link icon
- **Creator info** from Bluesky (handle, avatar, display name)
- **Estimated views** calculated from likes (likes × 10)
- **Click behavior** opens original Bluesky post instead of internal watch page

## Content Attribution

All Bluesky content:
- Links back to the original post
- Displays the creator's Bluesky handle
- Preserves engagement metrics (likes, reposts, replies)
- Is clearly marked as external content

## Rate Limiting

The Bluesky API has rate limits:
- **Unauthenticated**: ~300 requests per 5 minutes
- **Authenticated**: Higher limits (requires login)

Current implementation uses **unauthenticated access** for simplicity. For production with high traffic, consider:
1. Caching results (Redis, Vercel KV)
2. Authenticating with a Bluesky account
3. Implementing request throttling

## Future Enhancements

### Caching
Add Redis or Vercel KV to cache Bluesky results:
```typescript
// Check cache first
const cached = await redis.get('bluesky:drag:videos');
if (cached) return JSON.parse(cached);

// Fetch and cache
const videos = await searchDragContent();
await redis.setex('bluesky:drag:videos', 3600, JSON.stringify(videos)); // Cache for 1 hour
```

### User-Specific Feeds
Allow users to customize which Bluesky accounts they want to follow:
- Store preferences in Ceramic
- Fetch from user's custom list
- Mix with global drag content

### Video Proxying
For better performance, proxy Bluesky videos through your CDN:
- Download videos to Livepeer
- Store in your IPFS storage
- Serve from your infrastructure

## Troubleshooting

### No videos appearing

1. **Check API endpoint:**
   ```bash
   curl http://localhost:3000/api/bluesky/feed?limit=10
   ```

2. **Check browser console** for fetch errors

3. **Verify Bluesky is accessible:**
   ```bash
   curl https://bsky.social
   ```

### Rate limit errors

If you see 429 errors:
1. Reduce `limit` parameter
2. Implement caching
3. Add request throttling
4. Use authenticated Bluesky access

### Missing thumbnails

Some Bluesky posts don't have thumbnails:
- External links may not have preview images
- Old posts might have expired thumbnails
- Handle gracefully with placeholder images

## Code Locations

- **Bluesky client**: `/src/lib/bluesky/client.ts`
- **API route**: `/src/app/api/bluesky/feed/route.ts`
- **Homepage integration**: `/src/app/(platform)/page.tsx` (lines 66-77)
- **Video card handling**: `/src/components/video/video-card.tsx` (lines 17-18, 112-117)

## License & Attribution

This integration uses the AT Protocol (@atproto/api) which is open source (MIT License).

All Bluesky content remains the property of the original creators and is displayed with proper attribution.
