# YouTube API Quota Management

## Current Status

**Issue**: YouTube Data API v3 quota exceeded (10,000 units/day limit hit)

**Error Message**:
```
403 Forbidden: "The request cannot be completed because you have exceeded your quota"
```

**What This Means**:
- ✅ API key is valid
- ✅ YouTube Data API v3 is enabled
- ⚠️ Daily quota exhausted (resets at midnight PT)

---

## Understanding YouTube API Costs

Each API operation costs "units":
- **Search** (search.list): 100 units per request
- **Video details** (videos.list): 1 unit per request
- **Free tier limit**: 10,000 units/day

**Example**:
- Searching for 5 drag-related queries = 500 units
- Getting details for 50 videos = 50 units
- **Total**: 550 units per feed refresh

If you refreshed the feed 18+ times today during testing, that would hit the 10K limit.

---

## Solutions

### Option 1: Wait for Daily Reset (Recommended for Now)

**When**: Midnight Pacific Time (in ~4-8 hours depending on current time)

**What to do**:
1. Check quota status: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Wait for "Queries per day" to reset to 0/10000
3. YouTube content will automatically work again

**For Production**: Set up proper caching to avoid burning quota.

---

### Option 2: Reduce API Usage with Caching

**Problem**: Every page load = new API calls

**Solution**: Cache YouTube results

Create: `/src/lib/youtube/cache.ts`
```typescript
interface CachedYouTubeData {
  videos: Video[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: CachedYouTubeData | null = null;

export async function getCachedDragContent(limit: number): Promise<Video[]> {
  const now = Date.now();

  // Return cached data if less than 1 hour old
  if (cache && (now - cache.timestamp) < CACHE_DURATION) {
    console.log('[YouTube Cache] Returning cached results');
    return cache.videos.slice(0, limit);
  }

  // Fetch fresh data
  const videos = await searchDragContent(limit);

  // Cache for 1 hour
  cache = {
    videos,
    timestamp: now,
  };

  return videos;
}
```

Update `/src/app/api/youtube/feed/route.ts`:
```typescript
import { getCachedDragContent } from "@/lib/youtube/cache";

// Replace direct API call with cached version
videos = await getCachedDragContent(limit);
```

**Result**: API called once per hour instead of every page load
**Savings**: ~10x reduction in quota usage

---

### Option 3: Request Quota Increase (FREE)

**Steps**:
1. Go to https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Click "EDIT QUOTAS" button
3. Select "Queries per day"
4. Request increase to 50,000 or 100,000 units/day
5. Fill out form explaining use case: "Drag community video platform aggregating YouTube content"
6. Submit

**Timeline**: Google reviews manually, usually approved within 1-2 business days

**Success Rate**: High for legitimate use cases

---

### Option 4: Use Vercel's Edge Caching (Production)

**In production (Vercel)**, use edge caching:

Update `/src/app/api/youtube/feed/route.ts`:
```typescript
export const revalidate = 3600; // Cache for 1 hour

export async function GET(request: NextRequest) {
  // API call happens max once per hour on Vercel
  // All other requests served from edge cache
}
```

**Benefits**:
- Responses cached at Vercel edge (global CDN)
- API called once per hour max
- Fast responses for users
- Quota savings: ~100x reduction

---

## Best Practice: Hybrid Approach

**For Development (localhost)**:
1. Use longer cache (1-2 hours)
2. Or disable YouTube temporarily while developing other features
3. Enable only when testing YouTube-specific functionality

**For Production (Vercel)**:
1. Enable edge caching (revalidate: 3600)
2. Request quota increase to 50K/day
3. Monitor quota usage weekly

**Monitoring**:
- Check quota: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
- Set up alerts in Google Cloud Console at 80% usage
- Log API calls to track which queries cost the most

---

## Temporary Workaround (Right Now)

Since quota is exhausted and you want to deploy soon:

**Option A**: Disable YouTube API, use RSS only
```typescript
// In /src/app/api/youtube/feed/route.ts
// Comment out API section:

// if (process.env.YOUTUBE_API_KEY) {
//   console.log("[YouTube Feed API] Attempting YouTube Data API...");
//   try {
//     videos = await searchDragContent(limit);
//     source = "youtube-api";
//   } catch (apiError) {
//     console.warn("[YouTube Feed API] API failed, falling back to RSS:", apiError);
//     videos = [];
//   }
// }

// Skip straight to RSS:
videos = await fetchCuratedDragContent(limit);
source = "youtube-rss";
```

**Option B**: Just leave it as-is
- API gracefully falls back to RSS
- RSS also fails (404s on channel feeds - separate issue)
- Returns empty array gracefully
- App works fine without YouTube content

---

## Fixing RSS Feed 404s (Bonus)

All YouTube RSS feeds are returning 404. Possible reasons:
1. Channel IDs might be incorrect
2. YouTube may have changed RSS feed format
3. Channels may have disabled RSS

**Quick Test**:
```bash
# Test if RuPaul's Drag Race RSS works:
curl "https://www.youtube.com/feeds/videos.xml?channel_id=UCRt6GN7hNT2gE7E18d_sjRQ"

# If 404, try channel handle format:
curl "https://www.youtube.com/feeds/videos.xml?user=rupaulsdragrace"
```

**If both fail**: YouTube RSS may require authentication now, or channels changed IDs.

---

## Summary

**Today's Issue**: YouTube API quota exhausted from testing
**Impact**: No YouTube content in feeds (app still works fine)
**Quick Fix**: Wait for quota reset (midnight PT)
**Long-term Fix**: Implement caching + request quota increase

**For your deployment in 4 hours**:
- ✅ Code is ready
- ✅ Bluesky works perfectly
- ✅ Dragverse videos work
- ⚠️ YouTube empty until quota resets (non-critical)

**Next Steps**:
1. Deploy current code (YouTube will be empty, that's OK)
2. Tomorrow: Implement caching strategy
3. Tomorrow: Request quota increase from Google
4. Tomorrow: Fix RSS channel IDs if needed

Your app is production-ready. YouTube is a nice-to-have that we'll fully enable tomorrow!
