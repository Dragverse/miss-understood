# Testing Farcaster Native Posting

## Prerequisites

1. **Environment Setup:**
   ```bash
   # Generate encryption key
   openssl rand -hex 32

   # Add to .env.local
   FARCASTER_SIGNER_ENCRYPTION_KEY=<your-key>
   ```

2. **Database Setup:**
   Run both SQL migrations in Supabase SQL Editor:
   - `supabase-migrations/farcaster_signers.sql`
   - `supabase-migrations/followers_table.sql`

3. **User Requirements:**
   - Farcaster account linked via Privy
   - Warpcast app installed (mobile) or accessible (web)

---

## Test Flow 1: Enable Native Posting

### Step 1: Connect Farcaster Account
1. Go to Settings → Connected Accounts
2. Click "Connect" on Farcaster
3. Authenticate with Privy
4. Verify FID synced to database

### Step 2: Enable Native Posting
1. Go to Settings → Cross-Posting
2. Scroll to "Native Farcaster Posting" section
3. Click "Enable Native Posting"
4. **Expected:** Loading toast → "Signer created! Opening Warpcast for approval..."
5. **Expected:** Warpcast opens in new tab with approval request

### Step 3: Approve Signer in Warpcast
1. In Warpcast approval page, review permissions
2. Click "Approve" to allow Dragverse to post on your behalf
3. **Expected:** Approval confirmation in Warpcast

### Step 4: Verify Approval
1. Return to Dragverse settings
2. **Expected:** Page polls for approval (every 10 seconds)
3. **Expected:** After approval: "Farcaster signer approved! You can now post natively."
4. **Expected:** Green checkmark with "Native posting enabled"

---

## Test Flow 2: Create Native Farcaster Post

### Step 1: Create Text Post
1. Go to /feed
2. Click "Share Your Story"
3. Write test message: "Testing native Farcaster posting from Dragverse! 🎭"
4. Toggle **Farcaster** ON
5. Click "Post"
6. **Expected:** "Posted to Dragverse and Farcaster! ✨"

### Step 2: Verify Post on Farcaster
1. Open Warpcast
2. Go to your profile
3. **Expected:** Post appears with test message
4. **Expected:** Post timestamp matches creation time
5. **Expected:** Post shows it was posted by Dragverse (via your signer)

### Step 3: Test Post with Media
1. Create new post in Dragverse
2. Add image (drag & drop or select)
3. Write caption
4. Toggle Farcaster ON
5. Click "Post"
6. **Expected:** Post created successfully
7. Open Warpcast
8. **Expected:** Post shows with image embedded

---

## Test Flow 3: Cross-Post to Multiple Platforms

1. Create post in Dragverse
2. Toggle **Bluesky** and **Farcaster** ON
3. Write message: "Multi-platform test from Dragverse ✨"
4. Click "Post"
5. **Expected:** "Posted to Dragverse, Bluesky, and Farcaster! ✨"
6. Verify on all platforms:
   - Dragverse /feed
   - Bluesky timeline
   - Farcaster (Warpcast)

---

## Test Flow 4: Sync Farcaster Followers

### Step 1: Sync Followers
1. Go to your profile /u/[handle]
2. Click "Sync Farcaster" button
3. **Expected:** Button shows "Syncing..." with spinner
4. **Expected:** Toast: "Synced [N] Farcaster followers"

### Step 2: View Follower Breakdown
1. Click on follower count on profile
2. **Expected:** Breakdown expands
3. **Expected:** Shows:
   - Dragverse followers
   - Bluesky followers
   - Farcaster followers
4. **Expected:** Each platform has icon, count, and percentage bar

---

## Error Scenarios to Test

### 1. Posting Without Signer Setup
1. Connect Farcaster but don't enable native posting
2. Try to create post with Farcaster toggle ON
3. **Expected:** Error toast: "Farcaster posting not set up. Please enable native posting in settings."

### 2. Signer Not Approved
1. Create signer but don't approve in Warpcast
2. Try to post with Farcaster ON
3. **Expected:** Error toast with details about pending approval

### 3. Invalid Encryption Key
1. Change `FARCASTER_SIGNER_ENCRYPTION_KEY` to wrong value
2. Try to post
3. **Expected:** Error: "Failed to decrypt signer key"
4. **Action:** Restore correct key

### 4. Network Failure
1. Disconnect internet
2. Try to create Farcaster post
3. **Expected:** Error toast: "Failed to broadcast cast"
4. Reconnect and retry
5. **Expected:** Success

---

## Verification Checklist

### Backend
- [ ] Signer keys encrypted in database (check `farcaster_signers` table)
- [ ] Cast hashes saved to `posts` table (`farcaster_cast_hash` column)
- [ ] Followers synced to `followers` table with `source: 'farcaster'`
- [ ] API logs show successful cast creation

### Frontend
- [ ] Signer setup UI shows in settings
- [ ] Approval polling works
- [ ] Post composer shows Farcaster toggle
- [ ] Success/error toasts display correctly
- [ ] Follower breakdown animates smoothly

### Security
- [ ] Private keys never appear in API responses
- [ ] Private keys never appear in browser console
- [ ] Keys encrypted at rest in database
- [ ] RLS policies prevent unauthorized access

---

## Performance Testing

### 1. Cast Creation Speed
- Time from "Post" click to toast confirmation
- **Target:** < 2 seconds for text-only
- **Target:** < 5 seconds with media

### 2. Follower Sync Speed
- Time to fetch and sync 100+ followers
- **Target:** < 5 seconds

### 3. Concurrent Posts
- Create 3 posts rapidly (< 10 seconds apart)
- **Expected:** All posts succeed, all appear on Farcaster

---

## Cleanup After Testing

```sql
-- Remove test signers (run in Supabase SQL Editor)
DELETE FROM farcaster_signers WHERE user_did = 'your-test-did';

-- Remove test followers
DELETE FROM followers WHERE source = 'farcaster' AND creator_id IN (
  SELECT id FROM creators WHERE did = 'your-test-did'
);
```

---

## Troubleshooting

### Issue: "No Farcaster signer found"
**Solution:** Enable native posting in Settings → Cross-Posting

### Issue: "Signer not approved"
**Solution:** Open Warpcast and approve the signer request

### Issue: "Failed to decrypt signer key"
**Solution:** Check `FARCASTER_SIGNER_ENCRYPTION_KEY` is correct 64-char hex string

### Issue: Followers not syncing
**Solution:**
1. Check Farcaster FID is saved in `creators` table
2. Verify hub connectivity (nemes.farcaster.xyz:2283)
3. Check network logs for errors

### Issue: Posts not appearing on Farcaster
**Solution:**
1. Check `farcaster_cast_hash` is saved in database
2. Search Warpcast for hash: `https://warpcast.com/~/conversations/[hash]`
3. Verify signer is still approved in Warpcast settings

---

## Success Metrics

✅ **Native posting works** = Post appears on Farcaster within 5 seconds
✅ **Signer setup works** = Approval flow completes without errors
✅ **Followers sync works** = Correct count matches Warpcast
✅ **Multi-platform works** = Post appears on all selected platforms
✅ **Security works** = Keys never exposed, encrypted at rest
