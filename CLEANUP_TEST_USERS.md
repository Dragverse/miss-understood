# Clean Up Test Users

## Overview

You currently have **5 creators** in your database:
- **1 real user** (you): `did:privy:cmkgjgjd003ezla0cf5dweu37`
- **4 test users** with DIDs like: `test-1768734075986`, etc.

This guide will help you safely remove the test users while keeping your real account.

---

## Step 1: Preview What Will Be Deleted (Safe - Read Only)

### Option A: Via API Endpoint (Recommended)

Once you deploy the new cleanup endpoint, run:

```bash
curl https://www.dragverse.app/api/admin/cleanup-test-users | jq '.'
```

This shows:
- Which users will be deleted (test users)
- Which users will be kept (real Privy users)
- No actual deletion happens

### Option B: Check via Test Endpoint

```bash
curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query creators table")'
```

Look for users with DIDs that:
- ✅ **KEEP**: Start with `did:privy:` or `did:key:`
- ❌ **DELETE**: Start with `test-` or anything else

---

## Step 2: Clean Up Test Users

### Option A: Via API Endpoint (Safest)

```bash
curl -X DELETE https://www.dragverse.app/api/admin/cleanup-test-users | jq '.'
```

This will:
1. Find all users with DIDs NOT starting with `did:privy:` or `did:key:`
2. Delete them from the `creators` table
3. Return a summary of what was deleted

**Safety Features:**
- Only deletes users without proper Privy DIDs
- Your account (`did:privy:cmkgjgjd003ezla0cf5dweu37`) is protected
- Returns detailed log of what was deleted

### Option B: Via Supabase Dashboard (Manual)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Open your project: **dragverse**
3. Click **Table Editor** → **creators**
4. Filter by DID: `did NOT LIKE 'did:privy:%' AND did NOT LIKE 'did:key:%'`
5. Select test users
6. Click **Delete** button
7. Confirm deletion

---

## What Gets Deleted

### Test Users (Will Be Deleted) ❌

Based on the test endpoint, these users will be deleted:

```json
{
  "did": "test-1768734075986",
  "handle": "test-1768734075986",
  "display_name": "Test Creator"
}
```

```json
{
  "did": "test-1768734177556",
  "handle": "test-1768734177556",
  "display_name": "Test Creator"
}
```

And 2-3 more similar test users.

### Real User (Will Be Kept) ✅

```json
{
  "did": "did:privy:cmkgjgjd003ezla0cf5dweu37",
  "handle": "your-handle",
  "display_name": "Your Name"
}
```

Your video "gsz" is linked to this account and will NOT be affected.

---

## Expected Result

After cleanup:

```json
{
  "success": true,
  "message": "Successfully cleaned up 4 test users",
  "summary": {
    "testUsersFound": 4,
    "testUsersDeleted": 4,
    "realUsersKept": 1
  },
  "deletedUsers": [
    {"did": "test-1768734075986", "handle": "test-1768734075986"},
    {"did": "test-1768734177556", "handle": "test-1768734177556"},
    // ... more test users
  ],
  "realUsers": [
    {"did": "did:privy:cmkgjgjd003ezla0cf5dweu37", "handle": "your-handle"}
  ]
}
```

---

## Important Notes

### ⚠️ About Videos

- Your video "gsz" is linked to `did:privy:cmkgjgjd003ezla0cf5dweu37`
- This is a real Privy DID, so it will **NOT** be deleted
- Your video will remain intact

### ⚠️ About Foreign Keys

The `videos` table has a foreign key to `creators`:
```
videos.creator_id → creators.id
```

**If a creator has videos:**
- Supabase will either:
  1. Block deletion (if foreign key has NO ACTION)
  2. Delete associated videos (if ON DELETE CASCADE)
  3. Set creator_id to NULL (if ON DELETE SET NULL)

**For test users:**
- They shouldn't have any videos
- Safe to delete

### ⚠️ Backup (Optional)

If you want to be extra safe, back up test users first:

```bash
# Save test users to file
curl https://www.dragverse.app/api/admin/cleanup-test-users > test_users_backup.json
```

---

## Verification After Cleanup

### Check remaining users:
```bash
curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query creators table") | .count'
```

Should show: `1` (only you)

### Check your video still exists:
```bash
curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query videos table")'
```

Should show your "gsz" video with correct creator_did.

### Check debug endpoint:
```bash
curl https://www.dragverse.app/api/debug/videos | jq '.summary'
```

Should show:
```json
{
  "totalVideos": 1,
  "totalCreators": 1,
  "videosWithIssues": 0,
  "orphanedVideos": 0
}
```

---

## SQL Alternative (Advanced)

If you prefer direct SQL in Supabase:

### Preview (Read Only):
```sql
SELECT id, did, handle, display_name
FROM creators
WHERE did NOT LIKE 'did:privy:%'
  AND did NOT LIKE 'did:key:%';
```

### Delete:
```sql
DELETE FROM creators
WHERE did NOT LIKE 'did:privy:%'
  AND did NOT LIKE 'did:key:%';
```

**Returns:** Number of rows deleted

---

## Troubleshooting

### Error: "Foreign key constraint violation"

This means a test user has videos. Check which videos:

```sql
SELECT v.id, v.title, c.did, c.handle
FROM videos v
JOIN creators c ON v.creator_id = c.id
WHERE c.did NOT LIKE 'did:privy:%' AND c.did NOT LIKE 'did:key:%';
```

**Solution:** Either delete those videos first or reassign them to your account.

### Error: "Permission denied"

The cleanup endpoint requires proper authentication. Make sure you're signed in as admin.

### Nothing happens

Check the API response for error details:
```bash
curl -X DELETE https://www.dragverse.app/api/admin/cleanup-test-users | jq '.error, .details'
```

---

## Summary

**To clean up test users:**

1. **Deploy** the new cleanup endpoint
2. **Preview** what will be deleted:
   ```bash
   curl https://www.dragverse.app/api/admin/cleanup-test-users | jq '.'
   ```
3. **Delete** test users:
   ```bash
   curl -X DELETE https://www.dragverse.app/api/admin/cleanup-test-users | jq '.'
   ```
4. **Verify** only your account remains:
   ```bash
   curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query creators table") | .count'
   ```

Your video and account are safe! ✅
