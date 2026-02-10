-- Add crosspost tracking to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS crossposted_to TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bluesky_post_uri TEXT,
ADD COLUMN IF NOT EXISTS farcaster_cast_hash TEXT;

-- Add crosspost tracking to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS crossposted_to TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bluesky_post_uri TEXT,
ADD COLUMN IF NOT EXISTS farcaster_cast_hash TEXT;

-- Create index for faster crosspost queries
CREATE INDEX IF NOT EXISTS idx_videos_crossposted_to ON videos USING GIN (crossposted_to);
CREATE INDEX IF NOT EXISTS idx_posts_crossposted_to ON posts USING GIN (crossposted_to);

COMMENT ON COLUMN videos.crossposted_to IS 'Array of platforms this video was crossposted to (e.g., {bluesky, farcaster})';
COMMENT ON COLUMN videos.bluesky_post_uri IS 'Bluesky post URI for deletion (e.g., at://did:plc:xxx/app.bsky.feed.post/xxx)';
COMMENT ON COLUMN videos.farcaster_cast_hash IS 'Farcaster cast hash for deletion';
COMMENT ON COLUMN posts.crossposted_to IS 'Array of platforms this post was crossposted to';
COMMENT ON COLUMN posts.bluesky_post_uri IS 'Bluesky post URI for deletion';
COMMENT ON COLUMN posts.farcaster_cast_hash IS 'Farcaster cast hash for deletion';
