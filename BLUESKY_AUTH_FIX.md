# Bluesky Authentication Fix - URGENT

## 🚨 Root Cause Found

**The Bluesky credentials are INVALID/EXPIRED.**

Test result:
```bash
curl -X POST "https://bsky.social/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"reinasalti.xyz","password":"ix2i-x65l-5jpw-og7u"}'

# Response:
{"error":"AuthenticationRequired","message":"Invalid identifier or password"}
```

**Current credentials in `.env.local`:**
- `BLUESKY_IDENTIFIER=reinasalti.xyz`
- `BLUESKY_APP_PASSWORD=ix2i-x65l-5jpw-og7u` ← **INVALID**

---

## ✅ Fixes Implemented

I've implemented all the error handling improvements so that when you update the credentials, the site will work properly:

### 1. **Fail-Fast Authentication** (src/lib/bluesky/client.ts)
- Now throws error immediately if auth fails
- Clear logging: `✅ Authentication successful` or `❌ Authentication failed`
- Prevents unauthenticated agent from being used

### 2. **Better API Error Handling** (src/app/api/bluesky/feed/route.ts)
- Returns 401 for auth errors (not 500)
- Client knows it's an auth issue, not server error
- Empty arrays returned gracefully

### 3. **Fixed Invalid Handle** (src/lib/bluesky/drag-accounts.ts)
- Changed `rosé.bsky.social` → `rose.bsky.social` (removed special character)

### 4. **Added Handle Validation**
- New functions: `isValidBlueskyHandle()`, `getValidDragAccountHandles()`
- Filters out invalid handles automatically
- Warns in console about bad handles

### 5. **Error Recovery Already Present**
- Individual account fetch failures don't break entire feed
- Continues fetching from valid accounts

---

## 🔑 How to Generate New Bluesky App Password

### Step 1: Go to Bluesky Settings
1. Open https://bsky.app in your browser
2. Log in with your account (reinasalti.xyz or @reinasalti.bsky.social)
3. Click your profile icon (top right)
4. Select **Settings**

### Step 2: Navigate to App Passwords
1. In Settings, find **Privacy and Security** section
2. Click on **App Passwords**
3. You'll see a list of existing app passwords

### Step 3: Revoke Old Password (Optional but Recommended)
1. Find the old password in the list (might be named "Dragverse" or similar)
2. Click the **Revoke** button next to it
3. Confirm revocation

### Step 4: Generate New App Password
1. Click **Add App Password** button
2. Enter a name: `Dragverse Production`
3. Click **Create**
4. **COPY THE PASSWORD IMMEDIATELY** - it will only show once!
5. Format: `xxxx-xxxx-xxxx-xxxx` (4 groups of 4 characters)

### Step 5: Update Environment Variables

**Update `.env.local`:**
```bash
BLUESKY_IDENTIFIER=reinasalti.xyz
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # <-- NEW PASSWORD HERE
```

**Update Vercel Environment Variables:**
1. Go to https://vercel.com/dashboard
2. Select your Dragverse project
3. Go to **Settings** → **Environment Variables**
4. Find `BLUESKY_APP_PASSWORD`
5. Click **Edit**
6. Paste new password
7. Click **Save**
8. **Redeploy** the site (Vercel will prompt you)

---

## 🧪 Testing After Update

### 1. Test Credentials Locally
```bash
# Replace with your NEW password
curl -X POST "https://bsky.social/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"reinasalti.xyz","password":"YOUR-NEW-PASSWORD"}'
```

Expected Response:
```json
{
  "did": "did:plc:...",
  "handle": "reinasalti.xyz",
  "email": "...",
  "accessJwt": "...",
  "refreshJwt": "..."
}
```

### 2. Test API Endpoint
```bash
npm run dev
# In another terminal:
curl "http://localhost:3000/api/bluesky/feed?limit=10&contentType=all"
```

Expected: JSON with posts array (not empty)

### 3. Check Homepage
1. Open http://localhost:3000
2. Check browser console - should see:
   - `[Bluesky] ✅ Authentication successful`
   - `Loaded X Supabase, Y Bluesky, Z YouTube videos` (Y > 0)
3. Verify Trending Photos section shows content
4. No 500 or 401 errors

---

## 📝 What Changed in Code

### Files Modified:
1. **src/lib/bluesky/client.ts** - Fail-fast authentication
2. **src/app/api/bluesky/feed/route.ts** - Better error codes
3. **src/lib/bluesky/drag-accounts.ts** - Fixed handle + validation

### New Functions Added:
- `isValidBlueskyHandle(handle: string): boolean`
- `getValidDragAccountHandles(): string[]`

### Behavior Changes:
- **Before:** Auth fails silently, returns empty arrays, no clear error
- **After:** Auth fails loudly with clear error, returns 401, logs helpful messages

---

## 🚀 Deployment Steps

Once you've updated the password:

### Local Testing:
```bash
# 1. Update .env.local with new password
# 2. Restart dev server
npm run dev

# 3. Test homepage loads Bluesky content
open http://localhost:3000
```

### Deploy to Production:
```bash
# 1. Commit the code fixes (already done)
git add -A
git commit -m "🔧 Fix Bluesky authentication error handling + invalid handles"
git push origin main

# 2. Update Vercel env vars (see Step 5 above)
# 3. Trigger redeployment in Vercel dashboard
```

---

## ✅ Expected Outcome

**Homepage will show:**
- ✅ Supabase videos (already working)
- ✅ Bluesky posts and photos (FIXED after new password)
- ✅ YouTube videos (should work if not rate limited)
- ✅ Trending Photos section populated
- ✅ Dragverse Bytes with content from all sources

**Console will show:**
```
[Bluesky] ✅ Authentication successful
[Bluesky API] Fetching from 78 curated drag accounts
[getVideos] Found 4 videos, now fetching creator info...
[Videos] Loaded 4 Supabase, 12 Bluesky, 8 YouTube videos
```

---

## 🆘 Troubleshooting

### If homepage still shows 0 Bluesky after update:

1. **Check console for errors**
   - Look for `❌ Authentication failed` message
   - Verify the error message

2. **Verify new password works**
   ```bash
   curl -X POST "https://bsky.social/xrpc/com.atproto.server.createSession" \
     -H "Content-Type: application/json" \
     -d '{"identifier":"reinasalti.xyz","password":"YOUR-NEW-PASSWORD"}'
   ```

3. **Check environment variable**
   ```bash
   # In your terminal
   echo $BLUESKY_APP_PASSWORD
   # Should show the new password
   ```

4. **Clear Next.js cache**
   ```bash
   rm -rf .next
   npm run dev
   ```

5. **Check Vercel deployment logs**
   - Go to Vercel dashboard
   - Click on latest deployment
   - Check logs for `[Bluesky]` messages

---

## 📚 Resources

- [Bluesky App Passwords Documentation](https://blueskyweb.xyz/blog/3-6-2023-security-update)
- [AT Protocol Documentation](https://atproto.com/specs/at-protocol)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

---

**Status:** Code fixes committed, waiting for new Bluesky app password
**Priority:** 🔴 CRITICAL - Homepage broken without valid credentials
**ETA:** 5 minutes once new password is generated
