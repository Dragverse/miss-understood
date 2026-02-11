-- Followers Table (Multi-Platform)
-- Tracks followers from Dragverse, Bluesky, and Farcaster

CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  -- Dragverse follower (internal)
  follower_did TEXT, -- Follower's Privy DID (for Dragverse follows)

  -- External platform followers
  follower_fid INTEGER, -- Farcaster FID
  follower_bluesky_did TEXT, -- Bluesky DID

  -- Metadata
  source TEXT NOT NULL CHECK (source IN ('dragverse', 'bluesky', 'farcaster')),
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate follows from same source
  UNIQUE(creator_id, follower_did, source),
  UNIQUE(creator_id, follower_fid, source),
  UNIQUE(creator_id, follower_bluesky_did, source)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);
CREATE INDEX IF NOT EXISTS idx_followers_source ON followers(source);
CREATE INDEX IF NOT EXISTS idx_followers_follower_did ON followers(follower_did);
CREATE INDEX IF NOT EXISTS idx_followers_follower_fid ON followers(follower_fid);

-- RLS policies
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Anyone can read follower counts (public profiles)
CREATE POLICY "Follower counts are public"
  ON followers
  FOR SELECT
  USING (true);

-- Only service role can insert/update followers (via API)
CREATE POLICY "Service role can manage followers"
  ON followers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update synced_at timestamp
CREATE OR REPLACE FUNCTION update_followers_synced_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.synced_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER followers_synced_at
  BEFORE UPDATE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION update_followers_synced_at();

-- Helper function to get follower breakdown for a creator
CREATE OR REPLACE FUNCTION get_follower_breakdown(creator_uuid UUID)
RETURNS TABLE(
  source TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.source,
    COUNT(*)::BIGINT
  FROM followers f
  WHERE f.creator_id = creator_uuid
  GROUP BY f.source;
END;
$$ LANGUAGE plpgsql;
