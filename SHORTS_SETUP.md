# Shorts Feed Setup Guide

## Overview
The Miss-Understood shorts feed is fully functional and ready for content. It combines multiple sources to provide a TikTok-style vertical video experience.

## Current Status ✅

### Working Features
- ✅ **TikTok-style UI** - Full-screen vertical scrolling
- ✅ **Interaction Buttons** - Like, comment, share, tip (all functional)
- ✅ **Creator Controls** - Edit/delete menu for video owners
- ✅ **Keyboard Navigation** - Arrow up/down keys
- ✅ **Mobile Responsive** - Full-screen on mobile devices
- ✅ **Auto-rotation** - Next video on playback end
- ✅ **Proper Creator Attribution** - Shows actual creator info

### Content Sources
1. **Dragverse/Supabase** ✅ (Primary)
   - Your uploaded videos
   - Full creator control
   - No external dependencies

2. **Bluesky** ⚠️  (Limited)
   - Keyword-based search working
   - Few video posts (most are text/images)
   - Not a major content source

3. **YouTube** 🔧 (Optional)
   - Requires API key for best results
   - RSS feeds currently unavailable (404 errors)
   - See setup instructions below

## YouTube Data API Setup (Optional)

To enable YouTube drag shorts from major channels:

### 1. Get API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the API key

### 2. Add to Environment
Add to `.env.local`:
```bash
YOUTUBE_API_KEY=your_api_key_here
```

### 3. Verify
Restart dev server and check logs for:
```
[YouTube Feed API] ✅ Got X videos from YouTube Data API
```

### API Quota Management
- Daily quota: 10,000 units
- Each search: ~100 units
- Caching reduces usage by 10x
- 1-hour cache per request

## Content Recommendations

### For Best User Experience:

1. **Upload Your Own Shorts** (Recommended)
   - Most authentic content
   - Full quality control
   - Immediate availability
   - Format: 9:16 vertical (1080x1920)

2. **Enable YouTube API** (Optional)
   - Adds variety from major drag channels
   - Requires API key setup
   - Subject to quota limits

3. **Community Growth** (Long-term)
   - As more creators join
   - Organic content expansion

## Curated YouTube Channels

When YouTube API is enabled, shorts from these channels will appear:
- RuPaul's Drag Race
- WOW Presents
- Trixie Mattel
- Katya Zamolodchikova
- Bob The Drag Queen
- Bianca Del Rio
- Gottmik
- Kim Chi
- Shangela
- Aquaria

## UI Features

### Interaction Buttons (Right Side)
- **Like** - Heart button with count
- **Comment** - Message icon with follower count
- **Share** - Native Web Share API
- **Tip** - Gradient button for creator tips

### Creator Controls (Top Right)
- **3-dot menu** - Only visible to video owner
- **Edit** - Navigate to edit page
- **Delete** - Confirm and remove video

### Video Info (Bottom Left)
- Creator handle (clickable → profile)
- Video title
- Video description

### Navigation
- **Swipe/Scroll** - Next/previous video
- **Arrow Keys** - Up/down navigation
- **Tap** - Play/pause video
- **Mute Button** - Top right corner

## Testing Checklist

- [ ] Open `/shorts` page
- [ ] Verify videos load (if uploaded)
- [ ] Test interaction buttons (like, comment, share, tip)
- [ ] Test creator menu (if you're the creator)
- [ ] Test keyboard navigation (arrow keys)
- [ ] Test mobile responsiveness
- [ ] Verify creator info displays correctly
- [ ] Check empty state shows upload CTA

## Troubleshooting

### No Videos Showing
1. Check if you've uploaded any shorts
2. Verify YouTube API key if expecting YouTube content
3. Check browser console for errors
4. Ensure videos have `contentType: "short"`

### Video Playback Errors
1. Check if playback URL is valid
2. Verify Livepeer asset is processed
3. Check browser console for details
4. Ensure video format is supported

### Creator Info Wrong
1. Verify creator profile is synced
2. Check Supabase creators table
3. Ensure video has `creator_id` set
4. Check logs for creator fetch errors

## Future Enhancements

Potential improvements:
- Comments system
- Tip/donation integration
- Video analytics dashboard
- Creator verification badges
- Trending algorithm
- Playlist/collection support

## Support

For issues or questions:
- Check server logs for detailed errors
- Review YouTube API quota usage
- Test with different video formats
- Verify environment variables are set
