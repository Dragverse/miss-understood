-- Add default cross-posting platform preferences
-- Stores user's default platforms for cross-posting (Bluesky, Farcaster)

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS default_crosspost_platforms JSONB DEFAULT '{"bluesky": false, "farcaster": false}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN creators.default_crosspost_platforms IS
'Default platforms for cross-posting. User can override per-post in composer. Structure: {"bluesky": boolean, "farcaster": boolean}';
