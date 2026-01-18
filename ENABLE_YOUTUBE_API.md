# Enable YouTube Data API v3

**Error:** `YouTube Data API v3 has not been used in project 954128612920 before or it is disabled`

**Solution:** You need to enable the API in your Google Cloud project.

---

## Quick Fix (1 Click)

**Click this link:**
https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=954128612920

Then click the blue **"ENABLE"** button.

Wait 1-2 minutes for changes to propagate.

---

## Step-by-Step Instructions

### **Step 1: Open Google Cloud Console**

Go to: https://console.cloud.google.com/

### **Step 2: Select Your Project**

- Project ID: `954128612920`
- Should already be selected (from the link above)

### **Step 3: Enable YouTube Data API v3**

1. In the search bar, type: **"YouTube Data API v3"**
2. Click on **"YouTube Data API v3"** from results
3. Click the blue **"ENABLE"** button
4. Wait for "API enabled" confirmation

### **Step 4: Verify It's Enabled**

After enabling:
1. Go to: https://console.cloud.google.com/apis/dashboard?project=954128612920
2. Look for "YouTube Data API v3" in your enabled APIs list
3. Should show as "Enabled" ✅

---

## Test After Enabling

Wait 2-3 minutes for changes to propagate, then test:

```bash
# Test YouTube API
curl https://www.dragverse.app/api/youtube/test | jq '{success, tests}'
```

**Expected (if working):**
```json
{
  "success": true,
  "tests": {
    "searchTest": {
      "passed": true,
      "resultsFound": true
    }
  }
}
```

---

## If You See "Wait a few minutes"

The error message says:
> "If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry."

**This is normal!** After enabling:
- Wait 2-5 minutes
- Then test again
- API should work

---

## What This Fixes

Once enabled, YouTube Data API v3 will:
- ✅ Allow video searches
- ✅ Fetch drag-related content
- ✅ Show YouTube videos in `/shorts` feed
- ✅ Populate homepage with external content

---

## Summary

1. **Click:** https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=954128612920
2. **Enable:** Click blue "ENABLE" button
3. **Wait:** 2-5 minutes
4. **Test:** `curl https://www.dragverse.app/api/youtube/test`
5. **Enjoy:** YouTube videos in your shorts feed!

That's it! 🎉
