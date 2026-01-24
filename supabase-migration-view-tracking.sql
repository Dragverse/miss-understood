-- Migration: Unique View Tracking for Videos
-- Creates video_views table to track unique views by DID or session
-- Updates increment_video_views RPC function to use unique view tracking

-- Step 1: Create video_views tracking table
CREATE TABLE IF NOT EXISTS video_views (
  video_id TEXT NOT NULL,
  viewer_did TEXT,
  viewer_session TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, COALESCE(viewer_did, viewer_session))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewer ON video_views(viewer_did);
CREATE INDEX IF NOT EXISTS idx_video_views_session ON video_views(viewer_session);

-- Step 2: Update increment_video_views RPC function to use unique tracking
CREATE OR REPLACE FUNCTION increment_video_views(
  video_id_param TEXT,
  viewer_did_param TEXT DEFAULT NULL,
  viewer_session_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Insert view record (unique constraint prevents duplicates)
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
$$ LANGUAGE plpgsql;

-- Grant permissions (if needed)
GRANT SELECT, INSERT ON video_views TO authenticated;
GRANT SELECT, INSERT ON video_views TO anon;
