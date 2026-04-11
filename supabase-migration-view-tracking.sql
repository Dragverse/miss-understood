-- Migration: Unique View Tracking for Videos
-- Creates video_views table to track unique views by DID or session
-- Updates increment_video_views RPC function to use unique view tracking

-- Step 1: Create video_views tracking table
CREATE TABLE IF NOT EXISTS video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT NOT NULL,
  viewer_did TEXT,
  viewer_session TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  -- At least one identifier must be present
  CONSTRAINT viewer_identity CHECK (viewer_did IS NOT NULL OR viewer_session IS NOT NULL)
);

-- Unique constraint via index: one view per viewer per video
-- Uses COALESCE to create a composite unique key from whichever identifier is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_views_unique_viewer
  ON video_views (video_id, COALESCE(viewer_did, ''), COALESCE(viewer_session, ''));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewer ON video_views(viewer_did);
CREATE INDEX IF NOT EXISTS idx_video_views_session ON video_views(viewer_session);

-- Step 2: Create increment_video_views RPC function with unique tracking
CREATE OR REPLACE FUNCTION increment_video_views(
  video_id_param TEXT,
  viewer_did_param TEXT DEFAULT NULL,
  viewer_session_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Insert view record (unique index prevents duplicates)
  INSERT INTO video_views (video_id, viewer_did, viewer_session)
  VALUES (video_id_param, viewer_did_param, viewer_session_param)
  ON CONFLICT DO NOTHING;

  -- Update video view count based on unique views
  UPDATE videos
  SET views = (
    SELECT COUNT(DISTINCT COALESCE(viewer_did, viewer_session))
    FROM video_views
    WHERE video_views.video_id = video_id_param
  )
  WHERE id = video_id_param;
END;
$$;

-- Grant permissions for client-side view tracking
GRANT SELECT, INSERT ON video_views TO authenticated;
GRANT SELECT, INSERT ON video_views TO anon;
