# YouTube API Debugging Guide

**Issue:** YouTube API configured but returning 0 videos
**Status:** Improved logging deployed, awaiting diagnostics

---

## Quick Diagnostics

### **Test 1: Check if API is working**

```bash
curl https://www.dragverse.app/api/youtube/test | jq '.'
```

**What to look for:**
- `"success": true` → API key is valid
- `"resultsFound": true` → API is returning videos
- `"error"` → Shows exact error from YouTube

### **Test 2: Check feed endpoint**

```bash
curl https://www.dragverse.app/api/youtube/feed?limit=5 | jq '.'
```

**What to look for:**
- `"count": 0` → No videos (check diagnostics)
- `"diagnostics"` → Shows possible causes

### **Test 3: Check Server Logs**

On Vercel:
```bash
vercel logs --follow
```

Look for messages starting with `[YouTube]`:
- `✅ Found X videos` → Search working
- `❌ Search HTTP error` → API/quota issue
- `⚠️  No results` → Query returned nothing (normal)

---

## Possible Issues & Solutions

### **Issue 1: API Quota Exceeded** 🚫

**Symptoms:**
- API returns 403 error
- Message: "quotaExceeded" or "rateLimitExceeded"

**Check Quota:**
1. Go to: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Look at "Queries per day" usage
3. Free tier: 10,000 units/day

**Solution:**
- Wait until midnight PT for reset
- Or request quota increase in Google Cloud Console
- Or reduce search frequency (cache results)

### **Issue 2: Search Queries Too Specific** 🔍

**Previous queries:**
- "drag queen performance" → Too specific
- "rupaul drag race" → Multiple words might not match

**New queries (deployed):**
- "drag race" → Broad, popular
- "drag queen" → General term
- "rupaul" → Single word, more results

**If still 0 results:**
Try even simpler terms:
- "drag"
- "makeup"
- "performance"

### **Issue 3: API Key Restrictions** 🔐

**Symptoms:**
- API key works locally but not in production
- Error: "API key not valid for this request"

**Check Restrictions:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your API key
3. Check **"Application restrictions"**:
   - Should be: "HTTP referrers (web sites)"
   - Should include: `https://www.dragverse.app/*`
   - Should include: `http://localhost:3000/*` (for dev)

4. Check **"API restrictions"**:
   - Should include: "YouTube Data API v3"

**Solution:**
- Remove all restrictions temporarily to test
- Then add back only necessary ones

### **Issue 4: Network/Timeout Issues** 🌐

**Symptoms:**
- Intermittent failures
- Some queries work, others don't

**Solution:**
- Add retry logic (future enhancement)
- Increase timeout (if Vercel allows)
- Use simpler queries (fewer API calls)

---

## Improvements Deployed

### **1. Simplified Search Queries** ✅

**Before:**
```typescript
"drag queen performance"  // Too specific
"rupaul drag race"        // Multiple words
```

**After:**
```typescript
"drag race"      // Broad, popular
"drag queen"     // General
"rupaul"         // Simple
```

### **2. Better Error Logging** ✅

**Now shows:**
- ✅ Successful searches
- ❌ Errors with details
- ⚠️  Empty results (normal)

**Example logs:**
```
[YouTube] ✅ Found 7 videos for "drag race"
[YouTube] ⚠️  No results for "drag lip sync"
[YouTube] ❌ API error: quotaExceeded
```

### **3. Diagnostic Endpoint** ✅

**New endpoint:** `/api/youtube/test`

**Tests:**
- API key configuration
- Simple search query
- Shows sample video if found
- Quota information

---

## How YouTube Integration Works

### **Current Flow:**

1. **User visits `/shorts` page**
2. **Page calls `/api/youtube/feed?limit=30`**
3. **API searches YouTube with 8 queries:**
   - "drag race"
   - "drag queen"
   - "rupaul"
   - ... etc
4. **Each query costs ~100 quota units**
5. **Total cost: ~800 units per page load**
6. **Daily limit: 10,000 units = ~12 page loads**

### **Optimization Needed:**

To support more page loads per day:

1. **Cache results** (store in database)
   - Fetch once per hour/day
   - Serve from cache
   - Reduces API calls dramatically

2. **Use channel IDs** instead of search
   - More efficient
   - Only ~1 unit per video
   - Fetches directly from known channels

3. **Reduce number of queries**
   - Instead of 8 queries
   - Use 2-3 most popular

---

## Testing After Deployment

### **Step 1: Wait for Deployment**

Changes are pushed, Vercel will deploy automatically (~2 minutes).

### **Step 2: Test Diagnostic Endpoint**

```bash
curl https://www.dragverse.app/api/youtube/test | jq '.'
```

**Expected (if working):**
```json
{
  "success": true,
  "tests": {
    "searchTest": {
      "passed": true,
      "resultsFound": true,
      "sampleVideo": {
        "id": "...",
        "title": "...",
        "channel": "..."
      }
    }
  }
}
```

**If quota exceeded:**
```json
{
  "success": false,
  "error": "YouTube API returned error",
  "tests": {
    "searchTest": {
      "error": {
        "code": 403,
        "message": "quotaExceeded"
      }
    }
  }
}
```

### **Step 3: Test Feed Endpoint**

```bash
curl https://www.dragverse.app/api/youtube/feed?limit=5 | jq '{count, warning, diagnostics}'
```

**Expected (if working):**
```json
{
  "count": 10,
  "warning": null
}
```

**If still 0 videos:**
```json
{
  "count": 0,
  "warning": "No videos returned",
  "diagnostics": {
    "possibleCauses": [...]
  }
}
```

### **Step 4: Check Server Logs**

```bash
vercel logs --follow
```

**Look for:**
- `[YouTube] ✅ Found X videos` → Working!
- `[YouTube] ❌ API error` → Check error details
- `[YouTube] ⚠️  No results` → Normal for some queries

---

## Next Steps

### **If quota is the issue:**

1. **Short-term:**
   - Reduce API calls
   - Use fewer/simpler queries
   - Cache results

2. **Long-term:**
   - Request quota increase
   - Implement database caching
   - Use channel IDs instead of search

### **If searches return 0 results:**

1. **Verify queries work on YouTube.com:**
   - Search "drag race" manually
   - Should return thousands of results

2. **Try even simpler terms:**
   - Edit `DRAG_SEARCH_QUERIES` in client.ts
   - Use single words: "drag", "makeup", "performance"

3. **Use channel IDs:**
   - Switch to `VERIFIED_DRAG_CHANNELS`
   - More reliable, less quota

---

## Summary

| Issue | Status | Solution |
|-------|--------|----------|
| Search queries too specific | ✅ Fixed | Simplified to broader terms |
| Poor error logging | ✅ Fixed | Added detailed logs with emojis |
| No diagnostic endpoint | ✅ Fixed | Created /api/youtube/test |
| Quota limits | ⚠️ Possible | Need to check Cloud Console |
| API restrictions | ⚠️ Possible | Need to verify in Cloud Console |

**Next:** Test the diagnostic endpoint after deployment to see exact error!

**Commands to run:**
```bash
# 1. Test API
curl https://www.dragverse.app/api/youtube/test | jq '.'

# 2. Check quota
# Visit: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

# 3. Check logs
vercel logs --follow
```
