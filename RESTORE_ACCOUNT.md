# Restore Deleted Account

**Wallet Address:** `0x8fFd4850CD2Dc1044bf315D81E1ddBE659Ec4186`
**Status:** All creators and videos were deleted

---

## What Happened

When you deleted creators from Supabase, the foreign key constraint on the `videos` table likely had `ON DELETE CASCADE`, which automatically deleted all associated videos when the creator was deleted.

**Current State:**
- ✅ Supabase database: Alive and connected
- ❌ Creators count: 0
- ❌ Videos count: 0

---

## How to Restore

### Option 1: Sign In Again (Recommended)

The easiest way is to just sign in with Privy again. The app will automatically create your creator profile:

1. Go to https://www.dragverse.app
2. Click "Sign In"
3. Connect your wallet: `0x8fFd4850CD2Dc1044bf315D81E1ddBE659Ec4186`
4. Your profile will be auto-created

**What gets auto-created:**
- Creator profile with your wallet DID
- Default handle (from wallet address)
- Default display name

---

### Option 2: Manual Database Restore

If you had specific data you want to restore, you can manually create your account in Supabase:

#### Step 1: Go to Supabase Dashboard

1. Visit https://supabase.com/dashboard
2. Open your **dragverse** project
3. Click **Table Editor** → **creators**

#### Step 2: Insert Your Creator Record

Click **Insert** → **Insert row**, and enter:

```
did: did:privy:YOUR_PRIVY_DID
handle: your-handle
display_name: Your Name
avatar: (optional - URL to avatar image)
description: (optional)
verified: false
```

**To find your Privy DID:**
1. Sign in to https://www.dragverse.app
2. Open browser console (F12)
3. Run: `localStorage.getItem('privy:user')`
4. Look for the `id` field - that's your DID

---

### Option 3: Restore from Backup (If Available)

If you have a database backup, you can restore it:

#### Check for automatic backups:
1. Go to Supabase Dashboard
2. Click **Settings** → **Backups**
3. Look for automated daily backups
4. Restore to a point before deletion

---

## Re-Upload Your Video

Since your "gsz" video was also deleted, you'll need to re-upload it:

1. Sign in to https://www.dragverse.app
2. Click **Upload** (+ button)
3. Select your video file
4. Fill in details:
   - Title: "gsz"
   - Type: "Byte" (for short video)
   - Category: "Comedy" (or your preferred category)
5. Upload

---

## Prevent Future Accidents

### Database Protection

To prevent accidental deletions, you can:

1. **Change Foreign Key Behavior** (Advanced - requires database migration):
   ```sql
   -- This would prevent deleting creators with videos
   ALTER TABLE videos
   DROP CONSTRAINT videos_creator_id_fkey;

   ALTER TABLE videos
   ADD CONSTRAINT videos_creator_id_fkey
   FOREIGN KEY (creator_id) REFERENCES creators(id)
   ON DELETE RESTRICT;  -- Prevents deletion if videos exist
   ```

2. **Use Row Level Security (RLS)**:
   - Supabase has RLS policies that can prevent accidental deletions
   - Should be configured to only allow authenticated users to delete their own data

3. **Enable Point-in-Time Recovery**:
   - Supabase Pro plans have PITR
   - Allows you to restore database to any point in time

---

## Quick Recovery Steps

**Fastest way to get back up and running:**

1. **Sign in with Privy** at https://www.dragverse.app
   - Connect wallet: `0x8fFd4850CD2Dc1044bf315D81E1ddBE659Ec4186`
   - Profile auto-created ✅

2. **Go to Settings**:
   - Update your display name
   - Add avatar
   - Add social links

3. **Re-upload video**:
   - Go to Upload page
   - Upload your "gsz" video
   - Select "Byte" type
   - Fill in details

4. **Done!** Your account is restored

---

## Check Current State

```bash
# Check creators
curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query creators table") | .count'
# Currently: 0

# Check videos
curl https://www.dragverse.app/api/test-db | jq '.tests[] | select(.name == "Query videos table") | .count'
# Currently: 0
```

After signing in again:
```bash
# Should show 1 creator (you)
# After re-upload: should show 1 video
```

---

## What Was Lost

Based on our previous work:
- **Your creator profile** - Can be recreated by signing in
- **Your video "gsz"** - Need to re-upload
- **Test users** - These were supposed to be deleted anyway!

---

## Prevention Tips

1. **Never delete directly from Supabase** unless you're absolutely sure
2. **Use the app's delete functions** instead (they have safeguards)
3. **Enable database backups** in Supabase settings
4. **Test deletions in development** first

---

## Next Steps

1. ✅ **Sign in again** - Creates your account automatically
2. ✅ **Update profile** - Settings page
3. ✅ **Re-upload video** - Upload page
4. ✅ **Verify everything works** - Check /shorts, /profile pages

Your Dragverse account can be fully restored in about 5 minutes! 🎉
