# 🚀 DEPLOY DATABASE MIGRATION NOW

## ✅ Your Code is Already Deployed!
- Commit: `4667d3d`
- Status: ✅ Pushed to GitHub `main` branch
- All application code is live

## ⚠️ ONE STEP REMAINING: Database Migration

The application code expects new database tables. Run this migration to activate all features.

---

## 🎯 OPTION 1: Supabase Dashboard (EASIEST - 60 seconds)

### Step 1: Open Supabase SQL Editor
Click this link (replace with your project):
```
https://supabase.com/dashboard/project/vrjzqcqrpkeegufimfhv/sql
```

### Step 2: Copy Migration SQL
The migration is in: `supabase-migration-privacy.sql`

Or copy this directly:

```sql
-- Step 1: Add visibility column
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public'
CHECK (visibility IN ('public', 'unlisted', 'private'));

CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);

-- Step 2: Create share tokens table
CREATE TABLE IF NOT EXISTS video_share_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create access logs table
CREATE TABLE IF NOT EXISTS video_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_did TEXT,
  access_method TEXT CHECK (access_method IN ('direct', 'share_token', 'embed')),
  share_token_id UUID REFERENCES video_share_tokens(id) ON DELETE SET NULL,
  user_agent TEXT,
  referer TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON video_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_video ON video_share_tokens(video_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON video_share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_video ON video_access_logs(video_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_viewer ON video_access_logs(viewer_did);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON video_access_logs(viewer_ip, accessed_at DESC);

-- Step 5: Update existing videos
UPDATE videos SET visibility = 'public' WHERE visibility IS NULL;
```

### Step 3: Click "RUN"
- Paste SQL into the editor
- Click the green "Run" button
- Should complete in ~2 seconds

### Step 4: Verify Success
Run this to confirm:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('video_share_tokens', 'video_access_logs');
```
Should return 2 rows.

---

## 🎯 OPTION 2: Command Line with psql (If installed)

```bash
# Install psql if needed
brew install postgresql  # macOS
# or
sudo apt-get install postgresql-client  # Linux

# Run migration
source .env.local
PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
  -h aws-0-us-east-1.pooler.supabase.com \
  -p 6543 \
  -U "postgres.vrjzqcqrpkeegufimfhv" \
  -d postgres \
  -f supabase-migration-privacy.sql
```

---

## ✅ After Migration is Complete

### Test Immediately:

1. **Go to your app:**
   ```
   https://your-production-url.com/upload
   ```

2. **Check for privacy buttons:**
   - Should see 3 radio options: Public, Unlisted, Private
   - Upload a video as "Private"

3. **Verify in Database:**
   ```sql
   SELECT id, title, visibility FROM videos
   ORDER BY created_at DESC LIMIT 5;
   ```
   Should show `visibility` column!

4. **Test Share Modal:**
   - Go to any video
   - Click "Share" button
   - Modal should open with options

### Monitor Production:

```sql
-- Check privacy adoption
SELECT visibility, COUNT(*) FROM videos GROUP BY visibility;

-- Monitor share tokens
SELECT COUNT(*) FROM video_share_tokens;

-- Watch access logs
SELECT COUNT(*) FROM video_access_logs;
```

---

## 🎉 What Happens After Migration

**Immediately Active:**
- ✅ Privacy controls on upload form
- ✅ Access control enforced on videos
- ✅ Share modal functional
- ✅ Share tokens working
- ✅ Access logging active

**Safe Changes:**
- ✅ All existing videos set to "public" (no disruption)
- ✅ No downtime
- ✅ Backwards compatible
- ✅ Can rollback if needed

---

## 🆘 Troubleshooting

### Migration Fails?
- Check if tables already exist: `\dt` in psql
- Safe to re-run (uses `IF NOT EXISTS`)
- Check Supabase logs for errors

### Features Not Working?
1. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Check console for errors
3. Verify migration ran: Check for new tables
4. Clear Next.js cache: Delete `.next` folder, rebuild

### Need to Rollback?
```sql
-- Remove new features (if absolutely necessary)
ALTER TABLE videos DROP COLUMN IF EXISTS visibility;
DROP TABLE IF EXISTS video_access_logs;
DROP TABLE IF EXISTS video_share_tokens;
```

---

## 📊 Success Criteria

After migration, you should have:
- [x] Code deployed (4667d3d)
- [ ] Database migrated (run SQL above)
- [ ] Features tested
- [ ] Monitoring active

**Time Required:** 2 minutes
**Risk:** Very low (safe migration)
**Rollback:** Available if needed

---

## 🏁 Final Steps

1. ✅ Run the migration SQL (Option 1 or 2 above)
2. ✅ Test privacy upload
3. ✅ Test share modal
4. ✅ Monitor for 24 hours
5. ✅ Celebrate! 🎉

**Everything is ready - just run that SQL and you're live!**
