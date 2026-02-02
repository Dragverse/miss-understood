-- Dragverse Livestreaming Database Schema
-- Adds support for livestream management, recordings, and playback

-- Enable UUID extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STREAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Creator info
  creator_did TEXT NOT NULL,

  -- Livepeer integration
  livepeer_stream_id TEXT UNIQUE NOT NULL,
  stream_key TEXT NOT NULL, -- Keep encrypted/hashed in production
  playback_id TEXT NOT NULL,
  playback_url TEXT NOT NULL,
  rtmp_ingest_url TEXT NOT NULL,

  -- Stream metadata
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,

  -- Stream status
  is_active BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Recording settings
  record_enabled BOOLEAN DEFAULT true,

  -- Stats
  peak_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STREAM RECORDINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stream_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Associated stream
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Livepeer asset info
  livepeer_asset_id TEXT UNIQUE NOT NULL,
  playback_id TEXT NOT NULL,
  playback_url TEXT NOT NULL,
  download_url TEXT,

  -- Recording metadata
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,

  -- Status
  status TEXT CHECK (status IN ('processing', 'ready', 'failed')) DEFAULT 'processing',
  is_published BOOLEAN DEFAULT false, -- Whether converted to regular video
  published_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,

  -- Stats (inherited from stream or standalone)
  views INTEGER DEFAULT 0,

  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Streams indexes
CREATE INDEX IF NOT EXISTS idx_streams_creator_did ON streams(creator_did);
CREATE INDEX IF NOT EXISTS idx_streams_is_active ON streams(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_streams_livepeer_id ON streams(livepeer_stream_id);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON streams(created_at DESC);

-- Recordings indexes
CREATE INDEX IF NOT EXISTS idx_recordings_stream_id ON stream_recordings(stream_id);
CREATE INDEX IF NOT EXISTS idx_recordings_creator_did ON stream_recordings(creator_did);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON stream_recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_published ON stream_recordings(is_published);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON stream_recordings(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on streams table
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active streams
CREATE POLICY "Anyone can view active streams" ON streams
  FOR SELECT
  USING (is_active = true);

-- Policy: Creators can view all their streams
CREATE POLICY "Creators can view their own streams" ON streams
  FOR SELECT
  USING (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can insert their own streams
CREATE POLICY "Creators can create streams" ON streams
  FOR INSERT
  WITH CHECK (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can update their own streams
CREATE POLICY "Creators can update their own streams" ON streams
  FOR UPDATE
  USING (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can delete their own streams
CREATE POLICY "Creators can delete their own streams" ON streams
  FOR DELETE
  USING (creator_did = current_setting('app.current_user_did', true));

-- Enable RLS on stream_recordings table
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;

-- Policy: Published recordings are viewable by anyone
CREATE POLICY "Anyone can view published recordings" ON stream_recordings
  FOR SELECT
  USING (is_published = true AND status = 'ready');

-- Policy: Creators can view all their recordings
CREATE POLICY "Creators can view their own recordings" ON stream_recordings
  FOR SELECT
  USING (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can insert their own recordings
CREATE POLICY "Creators can create recordings" ON stream_recordings
  FOR INSERT
  WITH CHECK (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can update their own recordings
CREATE POLICY "Creators can update their own recordings" ON stream_recordings
  FOR UPDATE
  USING (creator_did = current_setting('app.current_user_did', true));

-- Policy: Creators can delete their own recordings
CREATE POLICY "Creators can delete their own recordings" ON stream_recordings
  FOR DELETE
  USING (creator_did = current_setting('app.current_user_did', true));

-- ============================================
-- FUNCTIONS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for streams table
DROP TRIGGER IF EXISTS update_streams_updated_at ON streams;
CREATE TRIGGER update_streams_updated_at
  BEFORE UPDATE ON streams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for stream_recordings table
DROP TRIGGER IF EXISTS update_recordings_updated_at ON stream_recordings;
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON stream_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES
-- ============================================
-- To run this migration:
-- 1. Copy this file contents
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and run the SQL
--
-- Security Notes:
-- - stream_key should be encrypted at rest in production
-- - Use RLS policies to ensure only authorized creators can manage streams
-- - Set app.current_user_did session variable on authenticated requests
