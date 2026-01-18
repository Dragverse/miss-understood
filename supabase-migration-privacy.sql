-- ============================================
-- MIGRATION: Add Privacy & Sharing Features
-- ============================================
-- Run this migration in Supabase SQL Editor to add privacy controls
-- to an existing Dragverse database

-- Step 1: Add visibility column to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public'
CHECK (visibility IN ('public', 'unlisted', 'private'));

-- Create index for visibility
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);

-- Step 2: Create share tokens table
CREATE TABLE IF NOT EXISTS video_share_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL, -- DID of creator
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create video access logs table
CREATE TABLE IF NOT EXISTS video_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_did TEXT,
  access_method TEXT CHECK (access_method IN ('direct', 'share_token', 'embed')),
  share_token_id UUID REFERENCES video_share_tokens(id) ON DELETE SET NULL,
  user_agent TEXT,
  referer TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON video_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_video ON video_share_tokens(video_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON video_share_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_access_logs_video ON video_access_logs(video_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_viewer ON video_access_logs(viewer_did);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON video_access_logs(viewer_ip, accessed_at DESC);

-- Step 5: Update existing videos to be public by default
UPDATE videos SET visibility = 'public' WHERE visibility IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All existing videos are now public by default
-- New privacy features are ready to use
