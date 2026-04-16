-- Migration: add livepeer_stream_id to videos table
-- Required by save-recording route to store the source stream reference
-- Run this in Supabase SQL Editor once

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS livepeer_stream_id TEXT;

-- Index for the repair API that re-fetches sessions by stream id
CREATE INDEX IF NOT EXISTS idx_videos_livepeer_stream_id ON videos(livepeer_stream_id);
