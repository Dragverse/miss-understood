# Debug Video Display Issues

## Quick Diagnostic Steps

### Step 1: Check Your Video in Database

Open your Supabase dashboard and run this SQL query:

```sql
-- Check all your videos
SELECT
  id,
  title,
  content_type,
  creator_did,
  playback_url,
  created_at
FROM videos
WHERE creator_did = 'YOUR_USER_DID'
ORDER BY created_at DESC
LIMIT 10;
```

**What to look for:**
- Is your "gsz" video in the results?
- What is the `content_type` value? Should be `"short"`
- Is `playback_url` populated?

---

### Step 2: Check Browser Console on Profile Page

1. Go to: http://localhost:3000/profile (or your deployed URL)
2. Open browser console (F12 or Cmd+Option+I)
3. Look for these log messages:

```
📹 Loaded X videos from Supabase for profile
```

4. Run this in console:

```javascript
// Check what videos are loaded
console.table(window.__DEBUG_VIDEOS__ || []);

// Check BYTES filter
const userVideos = /* copy from React DevTools */;
console.log('All videos:', userVideos);
console.log('Bytes only:', userVideos.filter(v => v.contentType === 'short'));
console.log('Content types:', userVideos.map(v => v.contentType));
```

---

### Step 3: Check Browser Console on Shorts Page

1. Go to: http://localhost:3000/shorts
2. Open browser console
3. Look for these messages:

```
[Shorts] Loaded X Supabase, Y Bluesky, Z YouTube videos
[Shorts] Displaying X shorts after filtering
```

4. Run this in console:

```javascript
// Check filtered shorts
console.log('Total videos loaded:', allVideos?.length || 0);
console.log('Shorts only:', shortsOnly?.length || 0);

// Check your specific video
console.log('My video:', allVideos?.find(v => v.title.includes('gsz')));

// Debug contentType mismatch
allVideos?.forEach(v => {
  if (v.contentType !== 'short' && v.contentType !== 'long') {
    console.warn('Unusual contentType:', v.id, v.contentType);
  }
});
```

---

### Step 4: Check Network Requests

1. Open Network tab in browser DevTools
2. Navigate to `/shorts` page
3. Look for these API calls:
   - `/api/video/...` or similar
   - Check response data

4. Click on the request and inspect the response:

```json
{
  "posts": [
    {
      "id": "...",
      "title": "gsz",
      "contentType": "short",  // ← Should be exactly "short"
      "playbackUrl": "...",
      ...
    }
  ]
}
```

---

### Step 5: Verify Upload

If video was just uploaded, check the upload response:

1. Look for console logs from upload:

```
✅ Video saved to Supabase successfully: VIDEO_ID
```

2. Check if fallback mode was used:

```
⚠️ Continuing in test mode with fallback user ID
```

If you see fallback mode, the video was saved to localStorage, not database!

---

## Common Issues & Solutions

### Issue: Video shows in profile but not in shorts feed

**Cause:** ContentType mismatch

**Solution:**
1. Check database: Is `content_type` = `"short"`?
2. If not, update it:

```sql
UPDATE videos
SET content_type = 'short'
WHERE id = 'YOUR_VIDEO_ID';
```

---

### Issue: Video saved in localStorage (fallback mode)

**Cause:** Authentication failed during upload

**Symptoms:**
- Console shows: `⚠️ Continuing in test mode with fallback user ID`
- Video shows on profile but not synced to database

**Solution:**
1. Re-upload the video while signed in
2. Or manually add to database using Supabase dashboard

---

### Issue: Video uploaded but thumbnail is broken

**Cause:** Thumbnail not generated or uploaded

**Solution:**
1. Check if `thumbnail` field in database is populated
2. If empty, it falls back to: `playbackUrl.replace("index.m3u8", "thumbnail.jpg")`
3. Manually upload a thumbnail in Supabase or re-upload video with thumbnail

---

### Issue: contentType is NULL or undefined

**Cause:** Database migration or old data

**Solution:**
```sql
-- Fix videos without contentType
UPDATE videos
SET content_type = CASE
  WHEN duration <= 60 THEN 'short'
  ELSE 'long'
END
WHERE content_type IS NULL;
```

---

## Test Scenarios

### Test 1: Is the video in the database?

```bash
# Using Supabase CLI (if installed)
supabase db query "SELECT id, title, content_type FROM videos WHERE title LIKE '%gsz%';"
```

### Test 2: Can you access the video directly?

Try navigating to:
- Profile page: Should see video in BYTES tab
- Direct link: `/watch/VIDEO_ID` (replace VIDEO_ID with your actual ID)

### Test 3: Is filtering working?

Add temporary logging to [src/app/(platform)/shorts/page.tsx](src/app/(platform)/shorts/page.tsx:83):

```typescript
// Line 83 - Add logging
const shortsOnly = allVideos.filter((v) => {
  const isShort = v.contentType === "short";
  console.log(`Video: ${v.title} | contentType: ${v.contentType} | isShort: ${isShort}`);
  return isShort;
});
```

Reload `/shorts` and check console output.

---

## Quick Fixes

### Fix 1: Force contentType to "short"

If you need an immediate fix, temporarily modify [src/app/(platform)/profile/page.tsx](src/app/(platform)/profile/page.tsx:174):

```typescript
// Line 174 - Force all short-duration videos to be "short"
contentType: "short",  // Temporary: force all as short
```

### Fix 2: Show all videos in shorts feed (temporary)

Modify [src/app/(platform)/shorts/page.tsx](src/app/(platform)/shorts/page.tsx:83):

```typescript
// Line 83 - Temporarily show all videos
const shortsOnly = allVideos; // Temporarily disabled filter
```

This helps identify if it's a filtering issue or data loading issue.

---

## Need More Help?

If none of the above work, provide this information:

1. **Database query result:**
   ```sql
   SELECT id, title, content_type, creator_did, playback_url
   FROM videos
   WHERE title LIKE '%gsz%';
   ```

2. **Browser console output from `/shorts` page:**
   - Any error messages
   - Value of `shortsOnly.length`
   - Value of `allVideos.length`

3. **Upload console logs:**
   - Did it say "✅ Video saved to Supabase successfully"?
   - Or did it use fallback mode?

4. **React DevTools inspection:**
   - Open React DevTools
   - Find `ShortsPage` component
   - Check `shorts` state value
   - Screenshot or copy the data

---

## Useful SQL Queries

### Check all videos with their contentType
```sql
SELECT
  id,
  title,
  content_type,
  duration,
  created_at,
  creator_did
FROM videos
ORDER BY created_at DESC
LIMIT 20;
```

### Find videos without contentType
```sql
SELECT id, title, content_type
FROM videos
WHERE content_type IS NULL OR content_type = '';
```

### Fix all videos based on duration
```sql
UPDATE videos
SET content_type = CASE
  WHEN duration <= 60 THEN 'short'
  WHEN duration > 60 THEN 'long'
  ELSE 'short'
END
WHERE content_type IS NULL OR content_type NOT IN ('short', 'long', 'podcast', 'music', 'live');
```

### Find your user's DID
```sql
SELECT DISTINCT creator_did FROM videos LIMIT 10;
```

---

## Architecture Diagram

```
Upload → Livepeer → /api/video/create
                          ↓
                    [Auth Check]
                          ↓
                    ┌─────┴─────┐
                    │           │
              [Success]    [Fallback]
                    │           │
                Supabase    localStorage
                    │           │
                    └─────┬─────┘
                          ↓
                    Profile Page
                          │
                    ┌─────┴─────┐
                    │           │
              [BYTES Tab]  [Shorts Feed]
                    │           │
              Filter by    Filter by
              contentType  contentType
              === 'short'  === 'short'
```

---

## Files to Check

If you need to make code changes, check these files:

1. **Shorts feed filtering:** [src/app/(platform)/shorts/page.tsx:83](src/app/(platform)/shorts/page.tsx#L83)
2. **Profile bytes filtering:** [src/app/(platform)/profile/page.tsx:354](src/app/(platform)/profile/page.tsx#L354)
3. **Video upload contentType:** [src/app/(platform)/upload/page.tsx:310](src/app/(platform)/upload/page.tsx#L310)
4. **API save contentType:** [src/app/api/video/create/route.ts:106](src/app/api/video/create/route.ts#L106)
5. **Video type definition:** [src/types/index.ts:36](src/types/index.ts#L36)
