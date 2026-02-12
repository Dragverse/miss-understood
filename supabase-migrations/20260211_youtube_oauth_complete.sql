-- Consolidated YouTube OAuth Migration
-- Run this to ensure all required columns exist

-- Add YouTube OAuth channel fields to creators table
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_channel_name TEXT,
  ADD COLUMN IF NOT EXISTS youtube_subscriber_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS youtube_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_expires_at TIMESTAMPTZ;

-- Remove old conflicting columns if they exist
ALTER TABLE creators
  DROP COLUMN IF EXISTS youtube_channel_handle,
  DROP COLUMN IF EXISTS youtube_follower_count;

-- Index for fast YouTube channel lookups
CREATE INDEX IF NOT EXISTS idx_creators_youtube_channel_id
  ON creators(youtube_channel_id);

-- Update followers table to support YouTube source
-- Check if constraint needs updating to include 'youtube'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'followers_source_check'
      AND table_name = 'followers'
  ) THEN
    ALTER TABLE followers DROP CONSTRAINT followers_source_check;
  END IF;

  -- Add updated constraint with YouTube
  ALTER TABLE followers ADD CONSTRAINT followers_source_check
    CHECK (source IN ('dragverse', 'bluesky', 'farcaster', 'youtube'));
END $$;

-- Add column to track YouTube subscriber count as aggregate
ALTER TABLE followers
  ADD COLUMN IF NOT EXISTS follower_youtube_count INTEGER DEFAULT 0;

-- Create index for YouTube followers
CREATE INDEX IF NOT EXISTS idx_followers_youtube_source
  ON followers(creator_id, source) WHERE source = 'youtube';

COMMENT ON COLUMN creators.youtube_channel_id IS 'YouTube channel ID verified via OAuth';
COMMENT ON COLUMN creators.youtube_subscriber_count IS 'Subscriber count from YouTube Data API';
COMMENT ON COLUMN creators.youtube_access_token IS 'Encrypted OAuth access token for YouTube API';
COMMENT ON COLUMN creators.youtube_refresh_token IS 'Encrypted OAuth refresh token for YouTube API';
COMMENT ON COLUMN creators.youtube_synced_at IS 'Last time YouTube channel data was synced';
COMMENT ON COLUMN followers.follower_youtube_count IS 'Aggregate YouTube subscriber count (placeholder for privacy compliance)';
