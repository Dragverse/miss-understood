# 🚀 Deploy Database Migration - RIGHT NOW

## ⚡ Quick Deploy Steps (2 minutes)

### Step 1: Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

### Step 2: Copy the Migration SQL
The migration is already in your clipboard! The file `supabase-migration-privacy.sql` contains:
- Add `visibility` column to videos table
- Create `video_share_tokens` table
- Create `video_access_logs` table
- Create all necessary indexes
- Set existing videos to 'public'

### Step 3: Execute in SQL Editor
1. Paste the SQL into Supabase SQL Editor
2. Click **"Run"** button
3. Wait for success message (~2 seconds)

### Step 4: Verify Success
Run this query to confirm:
```sql
-- Check all 3 features exist
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'videos' AND column_name = 'visibility') as has_visibility,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'video_share_tokens') as has_tokens,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'video_access_logs') as has_logs;

-- Should return: 1, 1, 1
```

---

## ✅ After Migration

Your production app will have:
- ✅ Privacy controls active
- ✅ Share tokens working
- ✅ Access control enforced
- ✅ Audit logging enabled

---

## 🧪 Quick Production Test

1. **Upload Test:**
   ```
   Go to: https://your-domain.com/upload
   - Should see privacy radio buttons
   - Upload a video as "Private"
   ```

2. **Verify Database:**
   ```sql
   SELECT id, title, visibility FROM videos
   ORDER BY created_at DESC LIMIT 5;
   -- Should show 'visibility' column with values
   ```

3. **Test Access Control:**
   ```
   - View your private video (logged in) → Works
   - View in incognito → Access denied
   ```

---

## 🎉 That's It!

Once the migration runs successfully, your production app has full privacy features enabled!

**Current Status:**
- ✅ Code deployed to production (commit 4667d3d)
- ⏳ Database migration (run the SQL above)
- ✅ All features tested and ready

**Time Required:** ~2 minutes
