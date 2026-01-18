# 🧪 Pre-Push Testing Checklist

## Before Running Tests

### 1. Run Database Migration
```bash
# Open Supabase Dashboard
# Go to SQL Editor
# Copy and paste contents of supabase-migration-privacy.sql
# Click "Run"
```

### 2. Verify Migration Success
```sql
-- Check visibility column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'videos' AND column_name = 'visibility';

-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('video_share_tokens', 'video_access_logs');

-- Should return both tables
```

### 3. Start Dev Server
```bash
npm run dev
# or
bun dev
```

---

## 🎯 Critical Tests (Must Pass)

### Test 1: Upload with Privacy Settings ✅
**Steps:**
1. Go to http://localhost:3000/upload
2. Sign in with Privy
3. Select a video file
4. Fill in title and category
5. **Select "Private" privacy option**
6. Upload

**Expected Result:**
- Upload succeeds
- Privacy radio buttons visible
- "Private" option selected
- No errors in console

**Verify:**
```sql
SELECT id, title, visibility FROM videos ORDER BY created_at DESC LIMIT 1;
-- Should show visibility = 'private'
```

### Test 2: Upload Public Video ✅
**Steps:**
1. Upload another video
2. Select "Public" privacy option
3. Submit

**Verify:**
```sql
SELECT id, title, visibility FROM videos ORDER BY created_at DESC LIMIT 1;
-- Should show visibility = 'public'
```

### Test 3: Access Control - Public Video ✅
**Steps:**
1. Get video ID from database
2. Go to http://localhost:3000/watch/{video-id}
3. Video should play without login

**Expected Result:**
- Video loads and plays
- No access denied message

### Test 4: Access Control - Private Video (Owner) ✅
**Steps:**
1. Sign in as creator
2. Go to your private video
3. Should play normally

**Expected Result:**
- Video loads and plays
- Share button available

### Test 5: Access Control - Private Video (Non-Owner) ✅
**Steps:**
1. Sign out or use incognito
2. Try to access private video URL
3. Should show access denied

**Expected Result:**
- Access denied screen with lock icon
- Message: "This video is private..."
- "Sign In" and "Go Home" buttons visible

### Test 6: Share Modal - Open/Close ✅
**Steps:**
1. Go to any video
2. Click "Share" button
3. Modal should open

**Expected Result:**
- Modal opens with share options
- Direct link shown
- Copy button works
- Close button works

### Test 7: Share Modal - Copy Link ✅
**Steps:**
1. Open share modal
2. Click copy button on direct link
3. Paste in notepad

**Expected Result:**
- Toast: "Link copied to clipboard!"
- Clipboard contains full URL
- Copy icon changes to check mark briefly

### Test 8: Share Token Generation ✅
**Steps:**
1. Sign in as video owner
2. Go to your private video
3. Click "Share"
4. Set expiration to "1 hour"
5. Click "Generate Link"

**Expected Result:**
- "Generating..." button state
- Success message
- Share URL with token displayed
- Token is 64+ characters

**Verify:**
```sql
SELECT token, expires_at, video_id FROM video_share_tokens
ORDER BY created_at DESC LIMIT 1;
-- Should show new token
```

### Test 9: Share Token Access ✅
**Steps:**
1. Copy generated share URL with token
2. Sign out or use incognito
3. Paste URL in browser
4. Should access private video

**Expected Result:**
- Private video loads successfully
- No access denied message

**Verify Access Log:**
```sql
SELECT video_id, viewer_did, access_method FROM video_access_logs
ORDER BY accessed_at DESC LIMIT 1;
-- Should show access_method = 'share_token'
```

### Test 10: Social Sharing (Public Video) ✅
**Steps:**
1. Go to public video
2. Click "Share"
3. Click Twitter icon
4. Should open Twitter

**Expected Result:**
- Twitter opens in new window
- Tweet contains video title and URL
- Window size ~600x400

---

## 🔍 Database Verification

### Check Video Privacy Distribution
```sql
SELECT visibility, COUNT(*) as count
FROM videos
GROUP BY visibility;

-- Should see mix of public/unlisted/private
```

### Check Share Tokens
```sql
SELECT
  v.title,
  vst.expires_at,
  vst.view_count,
  vst.max_views,
  vst.created_at
FROM video_share_tokens vst
JOIN videos v ON v.id = vst.video_id
ORDER BY vst.created_at DESC;

-- Should see generated tokens
```

### Check Access Logs
```sql
SELECT
  v.title,
  val.access_method,
  val.accessed_at
FROM video_access_logs val
JOIN videos v ON v.id = val.video_id
ORDER BY val.accessed_at DESC
LIMIT 10;

-- Should see logged accesses
```

---

## 🚨 Edge Cases to Test

### Test 11: Expired Share Token
**Steps:**
1. Generate token with 1 second expiration (modify code temporarily)
2. Wait 2 seconds
3. Try to access

**Expected Result:**
- Access denied
- Message: "This share link has expired"

### Test 12: Max Views Reached
**Steps:**
1. Generate token with max_views = 1
2. Access once (works)
3. Access again

**Expected Result:**
- Second access denied
- Message: "This share link has reached its view limit"

### Test 13: Invalid Token
**Steps:**
1. Go to video URL with fake token: `/watch/id?token=fake123`

**Expected Result:**
- Access denied
- Message: "Invalid share token"

### Test 14: Unlisted Video Access
**Steps:**
1. Upload as "Unlisted"
2. Try direct link without login
3. Should work

**Expected Result:**
- Video accessible via link
- Not in search/browse

---

## 🎨 UI/UX Tests

### Test 15: Privacy Radio Buttons
**Check:**
- [ ] All 3 options visible
- [ ] Descriptions clear
- [ ] Selected state highlighted
- [ ] Hover effects work
- [ ] Default is "Public"

### Test 16: Access Denied Screen
**Check:**
- [ ] Lock icon displayed
- [ ] Error message clear
- [ ] Sign in button works
- [ ] Go home button works
- [ ] Design matches app style

### Test 17: Share Modal Design
**Check:**
- [ ] Modal centered
- [ ] Backdrop darkens screen
- [ ] Close button works
- [ ] Copy buttons responsive
- [ ] Social icons colored correctly
- [ ] Expiration dropdown works
- [ ] Max views input accepts numbers

---

## 🐛 Common Issues & Fixes

### Issue: Migration Fails
**Fix:**
```sql
-- Drop tables if they exist
DROP TABLE IF EXISTS video_access_logs;
DROP TABLE IF EXISTS video_share_tokens;
-- Then run migration again
```

### Issue: TypeScript Errors
**Fix:**
```bash
rm -rf .next
npm run build
```

### Issue: Visibility Not Saving
**Check:**
1. Supabase service role key set
2. No RLS policies blocking
3. Console for validation errors

### Issue: Share Modal Not Opening
**Check:**
1. React Hot Toast installed
2. No console errors
3. ShareModal component imported

### Issue: Access Control Not Working
**This is expected if:**
- USE_MOCK_DATA is true (dev mode skips checks)
- Privy not configured (auth disabled)

---

## ✅ Pre-Push Checklist

Before pushing to production, verify:

- [ ] All critical tests pass (Tests 1-10)
- [ ] Database migration runs without errors
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors
- [ ] Privacy settings save correctly
- [ ] Access control works for all visibility types
- [ ] Share modal opens and functions
- [ ] Share tokens generate successfully
- [ ] Access logs recording properly
- [ ] UI looks good on mobile (test responsive)
- [ ] Git commit message is clear

---

## 🚀 Ready to Push

Once all tests pass:

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add video privacy controls and secure sharing

- Add privacy settings to upload (public/unlisted/private)
- Implement server-side access control
- Add share modal with token generation
- Add access audit logging
- Update database schema with security features
- Add comprehensive documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote
git push origin main
```

---

## 📊 Post-Deploy Monitoring

After pushing, monitor:

1. **Supabase Dashboard**
   - Check video_share_tokens table
   - Check video_access_logs table
   - Watch for errors in logs

2. **User Reports**
   - Can users upload with privacy?
   - Can users share private videos?
   - Any access denied errors?

3. **Database Queries**
   ```sql
   -- Monitor share token usage
   SELECT COUNT(*) FROM video_share_tokens;

   -- Monitor access attempts
   SELECT COUNT(*) FROM video_access_logs;

   -- Check privacy distribution
   SELECT visibility, COUNT(*) FROM videos GROUP BY visibility;
   ```

---

## 🆘 Rollback Plan (If Needed)

If critical issues found:

1. **Database Rollback:**
   ```sql
   -- Remove visibility column
   ALTER TABLE videos DROP COLUMN IF EXISTS visibility;

   -- Drop new tables
   DROP TABLE IF EXISTS video_access_logs;
   DROP TABLE IF EXISTS video_share_tokens;
   ```

2. **Code Rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Quick Fix:**
   - Set all videos to public temporarily
   - Disable access control checks
   - Fix issues
   - Re-deploy

---

## 📞 Support

If you encounter issues:
1. Check console for errors
2. Review Supabase logs
3. Verify environment variables
4. Test in incognito mode
5. Clear browser cache

All security features have been tested during development. This checklist ensures production readiness.
