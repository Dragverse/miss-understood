# Video Display Analysis & Issues

Generated: 2026-01-18

## Overview

This document provides a comprehensive analysis of how videos are displayed across different views in your Dragverse application, identifies issues, and provides recommendations.

---

## 1. Video Display Locations

### A. Shorts Feed (`/shorts`)
**Location:** [src/app/(platform)/shorts/page.tsx](src/app/(platform)/shorts/page.tsx)

**Display Implementation:**
- Full-screen vertical slider (TikTok-style)
- Uses KeenSlider for vertical snap-scroll navigation
- Container: `h-[calc(100vh-4rem)]` with black background
- Video sizing:
  - Mobile: `w-[calc(100vw-80px)]`
  - Desktop: `w-[450px]`
  - Ultrawide: `w-[650px]`
- Video component: [ShortVideo](src/components/shorts/short-video.tsx)
  - Aspect ratio: `9/16` (portrait)
  - Object fit: `object-contain` (preserves aspect ratio)
  - Background: `bg-gray-950` (dark background behind video)
  - Rounded corners: `rounded-large`

**Features:**
- Auto-plays when active slide
- Loops continuously
- Auto-advances to next video when finished
- Mute/unmute button (top-right)
- Play/pause on tap
- Keyboard navigation (arrow keys)
- Slide indicators at bottom

**Filters:**
- Only shows videos where `contentType === "short"` (line 83)

---

### B. Profile Page - BYTES Tab
**Location:** [src/app/(platform)/profile/page.tsx](src/app/(platform)/profile/page.tsx:651-681)

**Display Implementation:**
- Grid layout: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`
- Each byte card:
  - Aspect ratio: `aspect-[9/16]` (portrait)
  - Rounded corners: `rounded-2xl`
  - Hover effect: Border color changes from `border-[#EB83EA]/10` to `border-[#EB83EA]/30`
  - Thumbnail image: `object-cover` with scale on hover
  - Gradient overlay: `from-black/90 via-transparent to-transparent`
  - Title overlay at bottom

**Link Behavior:**
- Clicking a byte navigates to: `/shorts?v={video.id}`
- This should jump directly to that specific short in the feed

**Filters:**
- Line 354: `bytesList = userVideos.filter(v => v.contentType === 'short')`

---

### C. Profile Page - VIDEOS Tab
**Location:** [src/app/(platform)/profile/page.tsx](src/app/(platform)/profile/page.tsx:625-648)

**Display Implementation:**
- Grid layout: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
- Uses [VideoCard component](src/components/video/video-card.tsx)
- Horizontal video display (16:9 aspect ratio)
- Shows thumbnail, duration, creator avatar, title, views, likes

**Filters:**
- Line 353: `videosList = userVideos.filter(v => v.contentType !== 'short')`
- Shows all non-short videos (long, podcast, music, live)

---

### D. Dashboard Page
**Location:** [src/app/(platform)/dashboard/page.tsx](src/app/(platform)/dashboard/page.tsx)

**Display Implementation:**
- Similar grid to profile page
- Shows user's uploaded content
- Uses VideoCard component for horizontal videos

---

### E. Watch Page (`/watch/[id]`)
**Location:** [src/app/(platform)/watch/[id]/page.tsx](src/app/(platform)/watch/[id]/page.tsx)

**Display Implementation:**
- Full video player page
- Horizontal layout for long-form content
- Video controls, comments, related videos

---

## 2. Video Component Hierarchy

```
┌─────────────────────────────────────────┐
│         Video Display Components         │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    [Shorts]              [Long Videos]
        │                       │
    ShortVideo              VideoCard
        │                       │
   ┌────┴────┐            ┌────┴────┐
   │  Livepeer │          │ Thumbnail │
   │  Player  │          │   Link    │
   └──────────┘          └───────────┘
```

### ShortVideo Component
- **Path:** [src/components/shorts/short-video.tsx](src/components/shorts/short-video.tsx)
- **Purpose:** Full-screen vertical video player
- **Props:** `{ video, isActive, onNext }`
- **Key Features:**
  - Livepeer Player with HLS streaming
  - Aspect ratio: `9/16`
  - Object fit: `object-contain`
  - Auto-play/pause based on `isActive`
  - Video controls: mute, play/pause
  - Auto-advance on video end

### VideoCard Component
- **Path:** [src/components/video/video-card.tsx](src/components/video/video-card.tsx)
- **Purpose:** Thumbnail card for horizontal videos
- **Layouts:** Grid or List
- **Key Features:**
  - Aspect ratio: `16:9` (video aspect)
  - Object fit: `object-cover`
  - Shows duration, category, stats
  - Links to `/watch/[id]`

### ShortCard Component
- **Path:** [src/components/video/short-card.tsx](src/components/video/short-card.tsx)
- **Purpose:** Thumbnail card for shorts (used in home sections)
- **Key Features:**
  - Aspect ratio: `9/16`
  - Object fit: `object-cover`
  - "Short" badge
  - Links to `/shorts?v={id}`

---

## 3. Content Type Classification

### How contentType is Determined

**Upload Page** ([src/app/(platform)/upload/page.tsx](src/app/(platform)/upload/page.tsx:19))
- User manually selects: "Byte" (short) or "Video" (long)
- Form field: `contentType: "short" | "long"`

**Duration Validation:**
- **Byte (short):** Max 20 minutes (1200 seconds) - Line 105
- **Video (long):** 1-60 minutes (60-3600 seconds) - Lines 112-121

**Backend Processing** ([src/app/api/video/create/route.ts](src/app/api/video/create/route.ts:106))
- `content_type: contentType` - Uses user's selection

**Profile Page Fallback** ([src/app/(platform)/profile/page.tsx](src/app/(platform)/profile/page.tsx:174))
- If no contentType: `sv.content_type || ((sv.duration || 0) <= 60 ? "short" : "long")`
- Videos ≤60 seconds default to "short"
- Videos >60 seconds default to "long"

---

## 4. Critical Issues Identified

### Issue #1: Inconsistent Naming (BYTES vs SHORTS)
**Severity:** Medium - UX Confusion

**Problem:**
- Upload page calls them "Byte" (line 429)
- Profile page tab says "BYTES" (line 590)
- URL route is `/shorts`
- Internal code uses `contentType: "short"`
- Component is called `ShortVideo`

**Impact:** User confusion about terminology

**Recommendation:**
- Choose one term: Either "Bytes" or "Shorts"
- Update all UI labels consistently
- Keep internal code as `contentType: "short"` for consistency with industry standard

---

### Issue #2: Video Not Appearing in Shorts Feed
**Severity:** HIGH - Critical Bug

**Problem:**
The shorts page filters by `contentType === "short"` (line 83), but there may be issues:

1. **Upload saves as "short"** ✅ - Verified in upload page (line 19)
2. **API saves correctly** ✅ - Verified in video/create route (line 106)
3. **Profile loads and transforms** ❓ - Needs verification
4. **Shorts page filters** ✅ - Verified filter logic

**Potential Causes:**
1. Video uploaded but `contentType` wasn't saved correctly to database
2. Database column name mismatch (`content_type` vs `contentType`)
3. Video exists but is from external source (Bluesky/YouTube) with different contentType
4. Video created in localStorage fallback mode without proper contentType

**Debug Steps:**
1. Check database directly: What is stored in `content_type` column?
2. Check browser console on `/shorts` page: What does `shortsOnly` array contain?
3. Check browser console on `/profile` page: What is `bytesList` array?
4. Verify the uploaded video's metadata in Supabase

---

### Issue #3: Profile Grid Display
**Severity:** Low - UI Enhancement

**Current State:**
- Profile BYTES tab shows thumbnails in grid
- Clicking navigates to `/shorts?v={id}`

**Issues:**
- Shorts page doesn't handle `?v={id}` query parameter to jump to specific video
- Always starts at first video in feed

**Recommendation:**
- Add URL query parameter handling in shorts page
- Jump to specific video when `?v={id}` is present
- Example implementation:
```typescript
// In shorts page
const searchParams = useSearchParams();
const videoId = searchParams.get('v');

useEffect(() => {
  if (videoId && shorts.length > 0) {
    const index = shorts.findIndex(s => s.id === videoId);
    if (index >= 0) {
      instanceRef.current?.moveToIdx(index);
    }
  }
}, [videoId, shorts]);
```

---

### Issue #4: Object Fit Inconsistency
**Severity:** Low - Visual Polish

**Current State:**
- ShortVideo player: `object-contain` (shows black bars if needed)
- Profile BYTES grid: `object-cover` (crops to fill)
- ShortCard: `object-cover` (crops to fill)

**Impact:**
- In full-screen player: Videos that aren't exactly 9:16 show black bars
- In grid thumbnails: Videos are cropped to fit

**Recommendation:**
- `object-contain` is CORRECT for player (preserves full video)
- `object-cover` is CORRECT for thumbnails (looks better in grid)
- This is actually proper implementation - no change needed

---

### Issue #5: Missing Thumbnail Generation
**Severity:** Medium - UX Impact

**Current State:**
- Upload page allows optional thumbnail upload (lines 666-703)
- Falls back to Livepeer thumbnail: `playbackUrl.replace("index.m3u8", "thumbnail.jpg")` (line 306)

**Issues:**
- If user doesn't upload thumbnail AND Livepeer doesn't generate one, video has no thumbnail
- Grid views look broken without thumbnails

**Recommendation:**
- Generate thumbnail from video first frame on client side before upload
- Or use Livepeer's thumbnail API more reliably
- Add placeholder image if no thumbnail available

---

## 5. Video Display Styling Summary

### Shorts Player (Full-Screen)
```css
Container:
- width: calc(100vw - 80px) [mobile] | 450px [desktop] | 650px [ultrawide]
- height: 100% of parent
- background: rgb(10, 7, 26) /* #0a071a = gray-950 */
- border-radius: rounded-large
- padding: 0

Video Element:
- aspect-ratio: 9/16
- object-fit: contain
- width: 100%
- height: 100%
```

### Profile BYTES Grid
```css
Grid:
- grid-template-columns: repeat(2, 1fr) [mobile]
                        repeat(3, 1fr) [sm]
                        repeat(4, 1fr) [lg]
                        repeat(5, 1fr) [xl]
- gap: 1rem

Card:
- aspect-ratio: 9/16
- border-radius: 1rem
- overflow: hidden
- border: 2px solid rgba(235, 131, 234, 0.1)

Image:
- object-fit: cover
- transition: transform 300ms
- hover: scale(1.1)
```

### Profile VIDEOS Grid
```css
Grid:
- grid-template-columns: repeat(1, 1fr) [mobile]
                        repeat(2, 1fr) [sm]
                        repeat(3, 1fr) [lg]
                        repeat(4, 1fr) [xl]
- gap: 1.5rem

Card:
- aspect-ratio: 16/9
- border-radius: 0.75rem
- object-fit: cover
```

---

## 6. Data Flow for Video Upload

```
┌──────────────┐
│ Upload Form  │  User selects "Byte" or "Video"
└──────┬───────┘  contentType: "short" | "long"
       │
       │ Video file + metadata
       ▼
┌──────────────┐
│   Livepeer   │  Uploads video, gets asset ID
│   Upload     │  Returns playbackUrl
└──────┬───────┘
       │
       │ POST to /api/video/create
       ▼
┌──────────────┐
│  Auth Check  │  Verifies Privy token
└──────┬───────┘  Gets user DID
       │
       │ Verified DID
       ▼
┌──────────────┐
│   Supabase   │  Inserts to 'videos' table
│   Insert     │  Fields: creator_did, content_type, etc.
└──────┬───────┘
       │
       │ Success / Fallback
       ▼
┌──────────────┐
│  localStorage│  Fallback if DB fails
│   (Optional) │  Stores video data locally
└──────────────┘
```

---

## 7. Recommendations

### Immediate Actions

1. **Debug why video isn't appearing in shorts feed:**
   - Check Supabase database: `SELECT id, title, content_type FROM videos WHERE creator_did = 'YOUR_DID';`
   - Check browser console on `/shorts` page for filtered results
   - Verify the uploaded video's `content_type` value

2. **Standardize terminology:**
   - Decision: Use "Bytes" (more unique) or "Shorts" (more familiar)
   - Update all UI labels accordingly
   - Update route: Consider `/bytes` instead of `/shorts` if using "Bytes"

3. **Add query parameter support to shorts page:**
   - Handle `?v={videoId}` to jump to specific video
   - Update profile page links to use this parameter

### Future Enhancements

1. **Thumbnail generation:**
   - Auto-generate thumbnail from video first frame
   - Provide better fallback placeholder image
   - Cache thumbnails for faster loading

2. **Video orientation detection:**
   - Auto-detect vertical vs horizontal videos
   - Suggest contentType based on aspect ratio
   - Warn user if uploading wrong orientation for selected type

3. **Better error messages:**
   - If no shorts found: "Upload your first Byte" with button
   - If filtering issue: Show diagnostic info in dev mode
   - If external API fails: Show clear error state

4. **Performance optimization:**
   - Lazy load videos in shorts feed
   - Preload next video for smoother transitions
   - Optimize thumbnail sizes for grid views

---

## 8. Files to Check for Debugging

If your video isn't showing in the shorts feed, check these files in order:

1. **Database (Supabase):**
   - Table: `videos`
   - Check columns: `id`, `title`, `content_type`, `creator_did`, `playback_url`

2. **Shorts Page:** [src/app/(platform)/shorts/page.tsx](src/app/(platform)/shorts/page.tsx)
   - Line 83: `const shortsOnly = allVideos.filter((v) => v.contentType === "short")`
   - Check console.log output at line 88

3. **Profile Page:** [src/app/(platform)/profile/page.tsx](src/app/(platform)/profile/page.tsx)
   - Line 174: Check contentType transformation
   - Line 354: Check bytesList filter

4. **Video Create API:** [src/app/api/video/create/route.ts](src/app/api/video/create/route.ts)
   - Line 106: Verify `content_type: contentType` is saved
   - Check console logs for success/failure

5. **Upload Page:** [src/app/(platform)/upload/page.tsx](src/app/(platform)/upload/page.tsx)
   - Line 310: Verify contentType is sent in request body
   - Line 19: Verify formData.contentType value

---

## 9. Browser Console Debugging Commands

Run these in browser console on `/shorts` page:

```javascript
// Check if shorts are loaded
console.log('Shorts loaded:', shorts);

// Check filtering
console.log('All videos:', allVideos);
console.log('Shorts only:', allVideos.filter(v => v.contentType === 'short'));

// Check your specific video
console.log('My video:', allVideos.find(v => v.title.includes('YOUR_VIDEO_TITLE')));

// Check contentType values
console.log('Content types:', allVideos.map(v => ({ id: v.id, title: v.title, contentType: v.contentType })));
```

---

## Summary

Your video display implementation is well-structured with clear separation between short-form (vertical) and long-form (horizontal) content. The main issue is likely a data filtering problem where your uploaded video's `contentType` doesn't match "short" exactly. Follow the debug steps above to identify the root cause.

The styling is appropriate with `object-contain` for players (preserving full video) and `object-cover` for thumbnails (better grid appearance). The terminology inconsistency (Bytes vs Shorts) should be resolved for better UX.
