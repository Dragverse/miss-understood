# 🚀 Quick Start - Video Security Features

## 3-Minute Setup

### 1. Run Database Migration (2 min)

```bash
# Open Supabase Dashboard → SQL Editor
# Copy & paste contents of: supabase-migration-privacy.sql
# Click "Run"
```

### 2. Test Upload (1 min)

```bash
# Start dev server
npm run dev

# Go to http://localhost:3000/upload
# Upload a video
# ✨ NEW: Select "Private" privacy option
# Submit
```

### 3. Verify It Works

```sql
-- In Supabase SQL Editor:
SELECT id, title, visibility FROM videos ORDER BY created_at DESC LIMIT 5;

-- Should see your video with visibility = 'private'
```

---

## ✅ What You Can Do Now

### 1. Upload Private Videos
- Videos only you can see
- Not searchable or browsable

### 2. Generate Share Links
- Click "Share" on your video
- Generate temporary links that expire
- Set view limits (e.g., 10 views max)
- Revoke access anytime

### 3. Share Publicly
- Upload as "Public" for normal sharing
- Use "Unlisted" for link-only access

---

## 🎯 Common Scenarios

### Scenario 1: Share with a Client
```
1. Upload video as "Private"
2. Click "Share" button
3. Generate 24-hour link
4. Send to client
5. Link expires automatically
```

### Scenario 2: Public Release
```
1. Upload as "Private" initially
2. Review and edit
3. Change to "Public" (TODO: add edit UI)
4. Share on social media
```

### Scenario 3: Limited Preview
```
1. Upload as "Private"
2. Generate link with max 5 views
3. Share with team
4. After 5 views, link stops working
```

---

## 📊 Quick Check Commands

```sql
-- See all your videos
SELECT title, visibility FROM videos;

-- See active share tokens
SELECT * FROM video_share_tokens WHERE revoked = FALSE;

-- See recent access logs
SELECT * FROM video_access_logs ORDER BY accessed_at DESC LIMIT 10;
```

---

## ⚠️ Important Notes

1. **Access Denied?**
   - Make sure you're logged in (Privy)
   - Check if video is private and you're not the owner
   - Try with a valid share token

2. **Share Link Not Working?**
   - Check if token expired
   - Check if max views reached
   - Verify token wasn't revoked

3. **Can't Generate Share Link?**
   - Must be the video owner
   - Must be logged in
   - Only works for private/unlisted videos

---

## 🎉 You're All Set!

Your video platform now has:
- ✅ Privacy controls
- ✅ Secure sharing
- ✅ Access logging
- ✅ Production-ready security

For detailed docs, see: `IMPLEMENTATION_COMPLETE.md`
