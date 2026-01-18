-- Add YouTube integration fields to creators table
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT,
ADD COLUMN IF NOT EXISTS youtube_channel_handle TEXT,
ADD COLUMN IF NOT EXISTS youtube_follower_count INTEGER DEFAULT 0;

-- Create index for YouTube channel lookups
CREATE INDEX IF NOT EXISTS idx_creators_youtube_channel_id ON creators(youtube_channel_id);

-- Add comment
COMMENT ON COLUMN creators.youtube_channel_id IS 'YouTube channel ID for fetching subscriber count';
COMMENT ON COLUMN creators.youtube_channel_handle IS 'YouTube channel handle (@username)';
COMMENT ON COLUMN creators.youtube_follower_count IS 'YouTube subscriber count (cached)';
