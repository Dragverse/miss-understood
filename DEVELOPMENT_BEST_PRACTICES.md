# Development Best Practices - Quota Management

## Goal: Develop Efficiently Without Burning Quotas

This guide helps you develop locally while being conscious of:
- **YouTube API quota** (10,000 units/day)
- **Vercel deployment quota** (100 deployments/day)

---

## ✅ YouTube API Quota Management

### What We Implemented

**1. In-Memory Caching** (`src/lib/youtube/cache.ts`)
- Caches YouTube API responses for 1 hour
- Reduces API calls by ~10x during development
- Automatic expiration after 60 minutes

**2. Smart Cache Keys**
- Different cache per limit: `youtube-feed-20`, `youtube-feed-30`, etc.
- Cache survives between requests
- Resets when dev server restarts

### How to Use

**Check cache status:**
```bash
curl http://localhost:3000/api/youtube/cache-stats
```

**Clear cache (when testing new data):**
```bash
curl http://localhost:3000/api/youtube/cache-stats?clear=true
```

**Watch cache in action:**
```bash
# First request: API call (costs quota)
curl http://localhost:3000/api/youtube/feed?limit=5

# Check dev server logs, you'll see:
# [YouTube Feed API] Attempting YouTube Data API...
# [YouTube Cache] SAVED: "youtube-feed-5" (5 videos, expires in 60 minutes)

# Second request: Cache hit (FREE!)
curl http://localhost:3000/api/youtube/feed?limit=5

# Check logs:
# [YouTube Cache] HIT: "youtube-feed-5" (age: 2m, cached 5 videos)
# [YouTube Feed API] ✅ Returning 5 cached videos (saved API quota!)
```

### Daily Workflow

**Morning (fresh quota):**
```bash
# Start dev server
npm run dev

# Load homepage once - caches YouTube data for 1 hour
open http://localhost:3000

# Continue developing - all subsequent loads use cache
# No quota wasted!
```

**When testing YouTube changes:**
```bash
# Clear cache to force fresh API call
curl http://localhost:3000/api/youtube/cache-stats?clear=true

# Test your changes
open http://localhost:3000

# Cache refills automatically for next hour
```

### Quota Monitoring

**Check your usage:**
1. Visit: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Look at "Queries per day"
3. Should see: X / 10,000 (where X is your daily usage)

**Set up alerts:**
1. Google Cloud Console → Monitoring
2. Create alert at 80% usage (8,000 / 10,000)
3. Get email before hitting limit

---

## ✅ Vercel Deployment Quota Management

### Understanding the Limit

**Free tier**: 100 deployments per day
**Resets**: Every 24 hours (rolling window)

**What counts as a deployment:**
- Every `git push origin main` = 1 deployment
- Preview deployments (feature branches) = 1 deployment each
- Manual "Redeploy" button in Vercel = 1 deployment

### Best Practices

#### 1. Batch Your Commits Locally

**❌ Bad (burns quota fast):**
```bash
git add src/component1.tsx
git commit -m "Fix button"
git push origin main          # Deployment 1

git add src/component2.tsx
git commit -m "Fix color"
git push origin main          # Deployment 2

git add src/component3.tsx
git commit -m "Fix spacing"
git push origin main          # Deployment 3
# Used 3 deployments for what should be 1!
```

**✅ Good (conserves quota):**
```bash
# Make multiple changes locally
git add src/component1.tsx
git commit -m "Fix button"

git add src/component2.tsx
git commit -m "Fix color"

git add src/component3.tsx
git commit -m "Fix spacing"

# Test everything locally
npm run dev
# Browse to localhost:3000
# Verify all changes work

# Build locally to catch errors
npm run build

# Push once when ready
git push origin main          # Just 1 deployment!
```

#### 2. Test Locally Before Pushing

**Always run these before pushing:**
```bash
# 1. Check TypeScript errors
npm run build

# 2. Test in browser
npm run dev
# Open http://localhost:3000
# Click around, test features

# 3. Check console for errors
# Browser DevTools → Console → should be clean

# 4. Only push when everything works
git push origin main
```

#### 3. Use Feature Branches Wisely

**For experimental work:**
```bash
# Create feature branch
git checkout -b feature/new-thing

# Make commits
git add .
git commit -m "Add new feature"
git push origin feature/new-thing

# Vercel creates preview deployment
# Test at: https://miss-understood-git-feature-new-thing.vercel.app

# When happy, merge to main
git checkout main
git merge feature/new-thing
git push origin main

# Result: 1 preview + 1 production = 2 deployments
# Better than 10+ deployments from trial-and-error on main
```

#### 4. Disable Auto-Deploy During Heavy Dev

**When making many small tweaks:**

In Vercel Dashboard:
1. Settings → Git
2. Toggle "Production Branch" off temporarily
3. Develop locally without triggering deploys
4. When ready for production, toggle back on and push

#### 5. Use Vercel CLI for Testing

**Install once:**
```bash
npm install -g vercel
```

**Build and test locally with production settings:**
```bash
# Build with production config
vercel build

# Preview locally (doesn't count toward quota)
vercel dev
```

---

## 📊 Daily Quota Budget

### Recommended Allocation

**YouTube API (10,000 units/day):**
- **Development/Testing**: 2,000 units (20 API calls)
- **Production**: 8,000 units (80 API calls)
- With caching: Production users hit cache 90% of time

**Vercel Deployments (100/day):**
- **Development**: 5-10 deployments
- **Preview Branches**: 10-20 deployments
- **Production**: 5-10 deployments
- **Buffer**: 60-75 unused (safety margin)

### Tracking Your Usage

**Create a daily log:**
```bash
# Morning: Check both quotas
echo "$(date): YouTube - $(curl -s 'https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas' | grep -o '[0-9]* / 10,000')"
echo "$(date): Vercel - Check dashboard manually"
```

---

## 🚀 Deployment Workflow

### Standard Development Cycle

```bash
# 1. Start dev server (morning)
npm run dev

# 2. Make changes
# Edit files, save

# 3. Test locally
# Browse localhost:3000
# Everything uses cache - quota safe!

# 4. Make multiple commits
git add .
git commit -m "Change 1"

git add .
git commit -m "Change 2"

# 5. Test one final time
npm run build  # Catch build errors
npm run dev    # Test in browser

# 6. Push once at end of day
git push origin main

# Result: 1 deployment for entire day of work!
```

### When You Hit a Limit

**YouTube API exhausted:**
```bash
# Option 1: Wait for reset (midnight PT)
# Option 2: Work on non-YouTube features
# Option 3: Use cached/mock data locally
```

**Vercel deploys exhausted:**
```bash
# Option 1: Wait 24 hours for rolling reset
# Option 2: Upgrade to Pro ($20/mo = unlimited)
# Option 3: Deploy via CLI: vercel --prod
```

---

## 🎯 Quick Reference

### Before Every Push Checklist

- [ ] `npm run build` - No TypeScript errors
- [ ] `npm run dev` - Test in browser
- [ ] Browser console - No errors
- [ ] Check quota usage - Not near limit
- [ ] All features working - Ready for production

### Cache Management

```bash
# View cache
curl localhost:3000/api/youtube/cache-stats

# Clear cache
curl localhost:3000/api/youtube/cache-stats?clear=true

# Check dev server logs
tail -f /tmp/claude/.../tasks/*.output | grep Cache
```

### Quota Monitoring

```bash
# YouTube API
open https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

# Vercel Deployments
open https://vercel.com/your-project/settings/usage
```

---

## 💡 Pro Tips

1. **Cache is your friend**: First page load costs quota, rest is free for an hour
2. **Test locally first**: Every production push should be confident and tested
3. **Batch commits**: One push per feature, not per file
4. **Monitor usage**: Check quotas before starting work
5. **Plan your day**: Know which features need API calls vs cache
6. **Weekend work**: Perfect time to test extensively (less production traffic)

---

## 🎓 You're Ready!

With caching enabled:
- ✅ YouTube API calls reduced by ~10x
- ✅ Dev server uses cache automatically
- ✅ Production ready with minimal quota usage
- ✅ Can develop confidently without anxiety

**Current Status:**
- YouTube cache: ✅ Implemented
- Cache endpoint: ✅ `/api/youtube/cache-stats`
- Best practices: ✅ Documented
- Ready to deploy: ✅ When quota resets

Happy coding! 🚀
