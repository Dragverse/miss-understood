# Setup Instructions - Video Security Features

## 🚀 Quick Start

### Step 1: Run Database Migration

1. **Open Supabase Dashboard:**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Run the Migration:**
   Copy and paste the contents of `supabase-migration-privacy.sql` into the SQL Editor and execute it.

   Or use the Supabase CLI:
   ```bash
   supabase db push
   ```

3. **Verify Tables Created:**
   ```sql
   -- Check that visibility column exists
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'videos' AND column_name = 'visibility';

   -- Check new tables exist
   SELECT table_name
   FROM information_schema.tables
   WHERE table_name IN ('video_share_tokens', 'video_access_logs');
   ```

### Step 2: Install Dependencies (if needed)

The implementation uses existing dependencies, but if you encounter issues:

```bash
npm install
# or
bun install
```

### Step 3: Test Upload with Privacy Settings

1. **Start the dev server:**
   ```bash
   npm run dev
   # or
   bun dev
   ```

2. **Navigate to Upload Page:**
   ```
   http://localhost:3000/upload
   ```

3. **Try Uploading a Video:**
   - Select a video file
   - Fill in title, category
   - **NEW:** Select privacy setting (Public/Unlisted/Private)
   - Upload

4. **Verify in Supabase:**
   ```sql
   SELECT id, title, visibility, created_at
   FROM videos
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## ✅ What's Working Now

1. **Privacy Settings in Upload**
   - UI with 3 privacy options
   - Data saved to Supabase `visibility` column

2. **Database Schema**
   - `videos.visibility` column
   - `video_share_tokens` table
   - `video_access_logs` table

3. **Access Control Middleware**
   - Validates access based on visibility
   - Checks share tokens
   - Logs access attempts

4. **Share Token API**
   - Generate secure tokens
   - Validate and track usage
   - Support expiration and max views

## 🔄 What Needs Completion

1. **Watch Page Access Control** (~30 min)
   - Currently the watch page doesn't enforce privacy yet
   - Need to integrate access validation

2. **Rate Limiting** (~1-2 hours)
   - Need Redis/KV setup
   - Apply to upload endpoints

3. **Share Modal UI** (~1-2 hours)
   - Build the modal component
   - Integrate with token generation

## 🧪 Manual Testing Steps

### Test 1: Upload with Privacy
```
1. Go to /upload
2. Upload a video with "Private" selected
3. Check Supabase:
   SELECT * FROM videos WHERE visibility = 'private';
4. Expected: Video appears with visibility='private'
```

### Test 2: Database Schema
```sql
-- Should return privacy tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'video%';

-- Should show: videos, video_share_tokens, video_access_logs
```

### Test 3: Create Share Token (via Node REPL)
```typescript
// In node console or API route
import { createShareToken } from '@/lib/utils/share-tokens';

const result = await createShareToken(
  'video-uuid-here',
  'creator-did-here',
  { expiresIn: 3600, maxViews: 10 }
);

console.log(result.shareUrl);
// Should return URL with token
```

## 🐛 Troubleshooting

### Issue: Migration Fails
**Solution:** Check if tables already exist. Use `DROP TABLE IF EXISTS` or modify migration.

### Issue: Visibility Not Saving
**Solution:**
1. Check console for validation errors
2. Verify Supabase RLS policies allow inserts
3. Check that `SUPABASE_SERVICE_ROLE_KEY` is set

### Issue: Access Control Not Working
**Solution:**
- This is expected - watch page integration is incomplete
- Videos are still publicly accessible until we finish watch page

### Issue: TypeScript Errors
**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## 📊 Monitoring

### Check Access Logs
```sql
SELECT
  v.title,
  val.viewer_did,
  val.access_method,
  val.accessed_at
FROM video_access_logs val
JOIN videos v ON v.id = val.video_id
ORDER BY val.accessed_at DESC
LIMIT 20;
```

### Check Share Tokens
```sql
SELECT
  v.title,
  vst.token,
  vst.expires_at,
  vst.view_count,
  vst.max_views,
  vst.revoked
FROM video_share_tokens vst
JOIN videos v ON v.id = vst.video_id
ORDER BY vst.created_at DESC;
```

### Check Privacy Distribution
```sql
SELECT
  visibility,
  COUNT(*) as count
FROM videos
GROUP BY visibility;
```

## 🔐 Security Notes

1. **Share Tokens:** 64-character hex strings (cryptographically secure)
2. **Access Logs:** Include IP, user agent, referer for audit trail
3. **Token Expiration:** Automatically enforced server-side
4. **Max Views:** Enforced and incremented on each access

## 🎯 Next Development Session

**Priority Queue:**
1. Finish watch page access control (30 min)
2. Test end-to-end privacy flow (30 min)
3. Implement rate limiting (1-2 hours)
4. Build share modal component (1-2 hours)

**Files to Work On:**
- `src/app/(platform)/watch/[id]/page.tsx` - Complete access control
- `src/lib/middleware/rate-limit.ts` - Create rate limiting
- `src/components/video/share-modal.tsx` - Create share modal

## 📚 References

- **Audit Plan:** See `~/.claude/plans/cached-wibbling-hoare.md`
- **Implementation Status:** See `IMPLEMENTATION_STATUS.md`
- **Schema:** See `supabase-schema.sql` and `supabase-migration-privacy.sql`
