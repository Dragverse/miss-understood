-- Add columns for social media follower aggregation
-- Adds Farcaster FID and cached follower counts for all platforms

-- Add Farcaster FID (user ID) column
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS farcaster_fid BIGINT;

-- Add cached follower count columns for external platforms
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS bluesky_follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS farcaster_follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS youtube_follower_count INTEGER DEFAULT 0;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_farcaster_fid
ON creators(farcaster_fid)
WHERE farcaster_fid IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN creators.farcaster_fid IS
'Farcaster FID (user ID number) for the connected Farcaster account.';

COMMENT ON COLUMN creators.bluesky_follower_count IS
'Cached follower count from Bluesky. Updated periodically by the aggregation API.';

COMMENT ON COLUMN creators.farcaster_follower_count IS
'Cached follower count from Farcaster. Updated periodically by the aggregation API.';

COMMENT ON COLUMN creators.youtube_follower_count IS
'Cached subscriber count from YouTube. Updated periodically by the aggregation API.';
