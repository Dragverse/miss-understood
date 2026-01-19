# YouTube Channel Claiming Feature

## Overview
Allow users to "claim" their YouTube channel and automatically import their videos into their Dragverse profile, similar to the Bluesky profile claiming system.

## How It Works

### 1. User Connects Google Account
- User connects their Google account via Privy (already implemented)
- Google OAuth includes YouTube Data API access
- Privy stores Google account info in `user.google`

### 2. Claim YouTube Channel
When user clicks "Claim YouTube Channel" in settings:

1. Fetch YouTube channel ID from Google API (using OAuth token)
2. Fetch channel info (name, subscriber count, etc.)
3. Show preview of channel with video count
4. User confirms they want to claim this channel
5. Store `youtube_channel_id` in Supabase `creators` table
6. Sync recent videos (last 20) to user's profile

### 3. Video Display
- YouTube videos appear on user's profile alongside Dragverse uploads
- Tagged with `source: "youtube"` but `creator_did: {user's DID}`
- Clicking opens on YouTube (not Dragverse player)
- Videos update automatically (daily sync via cron job)

## Implementation Plan

### Phase 1: Database Schema
Add to `creators` table:
```sql
ALTER TABLE creators
ADD COLUMN youtube_channel_id VARCHAR(255),
ADD COLUMN youtube_channel_name VARCHAR(255),
ADD COLUMN youtube_subscriber_count INTEGER DEFAULT 0,
ADD COLUMN youtube_claimed_at TIMESTAMP,
ADD COLUMN youtube_last_synced_at TIMESTAMP;
```

### Phase 2: API Endpoints

#### `/api/youtube/get-channel-info`
- **Input**: Google OAuth token (from Privy)
- **Action**: Fetch YouTube channel ID and info from Google API
- **Output**: Channel info (ID, name, subscribers, video count)

#### `/api/youtube/claim-channel`
- **Input**: YouTube channel ID
- **Action**:
  - Verify user owns the channel (via OAuth token)
  - Update `creators` table with channel info
  - Sync recent videos
- **Output**: Success + video count

#### `/api/youtube/sync-videos`
- **Input**: Creator DID
- **Action**: Fetch latest videos from RSS feed, update database
- **Output**: Number of videos synced

### Phase 3: UI in Settings Page

Add YouTube section to `/settings` page:

```tsx
// YouTube Channel Section
{googleAccount && (
  <div className="bg-[#18122D] rounded-xl p-6">
    <h3>YouTube Channel</h3>

    {!youtubeChannelId ? (
      <>
        <p>Connect your YouTube channel to import your videos</p>
        <button onClick={handleClaimYouTube}>
          Claim YouTube Channel
        </button>
      </>
    ) : (
      <>
        <p>@{youtubeChannelName}</p>
        <p>{youtubeVideoCount} videos imported</p>
        <button onClick={handleSyncYouTube}>
          Sync New Videos
        </button>
        <button onClick={handleUnlinkYouTube}>
          Unlink Channel
        </button>
      </>
    )}
  </div>
)}
```

### Phase 4: Video Feed Integration

Update `/profile/page.tsx`:
- Fetch videos with `creator_did = {user}` (includes both Dragverse + YouTube)
- Filter by source if needed
- Display all videos in grid

Update `/videos/page.tsx`:
- Already shows all videos from all sources
- User's claimed YouTube videos now appear there too

## Benefits

1. **Content Discovery**: More videos on platform = more engagement
2. **Creator Onboarding**: Instant content for new creators
3. **Cross-Platform**: Helps creators promote their YouTube to Dragverse audience
4. **No Manual Upload**: Videos import automatically
5. **Authentic**: Only actual channel owners can claim (verified via OAuth)

## Considerations

### Permissions
- Requires Google OAuth with YouTube Data API scope
- Users must grant "View your YouTube channel" permission

### Sync Frequency
- Initial sync: Last 20 videos
- Daily sync: Check for new videos
- Manual sync: Button in settings

### Storage
- Don't duplicate video files (keep on YouTube)
- Only store metadata (title, thumbnail, URL)
- No bandwidth cost for Dragverse

### Privacy
- Users control which videos show (can hide specific videos)
- Can unlink channel anytime (removes all synced videos)

## Alternative: RSS-Only Approach

Instead of YouTube Data API (requires OAuth scopes), use RSS feeds:

### Pros:
- No API quota limits
- No additional OAuth scopes needed
- Works with just channel ID

### Cons:
- Can't verify channel ownership automatically
- User must manually provide channel ID
- Less metadata (no subscriber count, etc.)

### Implementation:
1. User enters their YouTube channel URL or ID
2. Fetch RSS feed to verify channel exists
3. Show preview of videos
4. User confirms (honor system for ownership)
5. Sync videos via RSS

## Recommended Approach

**Use RSS-Only** for simplicity:
- Easier implementation (no new OAuth scopes)
- No API quotas
- Still provides all needed functionality
- Similar to how Bluesky works (user provides handle + app password)

**User Flow:**
1. User clicks "Claim YouTube Channel"
2. Modal asks for YouTube channel URL
3. Extract channel ID, fetch RSS
4. Show preview: "Found {X} videos from {Channel Name}"
5. User confirms
6. Store channel ID, sync videos

This matches the Bluesky flow exactly!
