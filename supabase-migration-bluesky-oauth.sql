-- Bluesky OAuth Migration
-- Run this in Supabase SQL Editor

-- Temporary state during OAuth authorization flow (short-lived)
CREATE TABLE IF NOT EXISTS bluesky_oauth_state (
  key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Persistent OAuth sessions (auto-refreshed by atproto library)
CREATE TABLE IF NOT EXISTS bluesky_oauth_session (
  key TEXT PRIMARY KEY,
  session JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of expired state entries
CREATE INDEX IF NOT EXISTS idx_oauth_state_created ON bluesky_oauth_state(created_at);

-- Add OAuth DID column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS bluesky_oauth_did TEXT;

-- RLS policies for OAuth tables (service role only)
ALTER TABLE bluesky_oauth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluesky_oauth_session ENABLE ROW LEVEL SECURITY;

-- No public access - only service role key can read/write
-- (These tables are only accessed from server-side API routes)
