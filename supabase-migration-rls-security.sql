-- ============================================
-- Migration: Enable RLS + Security Policies
-- Date: 2026-02-14
-- Purpose: Address all Supabase database linter findings
-- ============================================
--
-- IMPORTANT: All writes go through API routes using the service role key,
-- which bypasses RLS. These policies only restrict what the public anon key
-- can do (exposed in the client bundle).
--
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 1. ENABLE RLS ON TABLES WITHOUT IT
-- ============================================

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- NOTE: video_views table does not exist yet.
-- Run supabase-migration-view-tracking.sql first if you want unique view tracking.

-- ============================================
-- 2. PUBLIC CONTENT TABLES — anon can SELECT
-- ============================================

-- CREATORS: Public profiles (exclude sensitive columns via view or select specific columns)
CREATE POLICY "Anyone can view creator profiles"
  ON creators FOR SELECT
  TO anon, authenticated
  USING (true);

-- VIDEOS: Only public videos are visible to anon
CREATE POLICY "Anyone can view public videos"
  ON videos FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public');

-- FOLLOWS: Who follows whom is public info
CREATE POLICY "Anyone can view follows"
  ON follows FOR SELECT
  TO anon, authenticated
  USING (true);

-- LIKES: Video likes are public
CREATE POLICY "Anyone can view likes"
  ON likes FOR SELECT
  TO anon, authenticated
  USING (true);

-- COMMENTS: Video comments are public
CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- 3. PRIVATE/SENSITIVE TABLES — no anon access
-- ============================================

-- NOTIFICATIONS: Only the recipient can read their own notifications
-- (All access goes through /api/notifications which uses service role)
-- No policy for anon = anon gets nothing

-- TRANSACTIONS: Financial data is private
-- (All access goes through /api/tips/record which uses service role)
-- No policy for anon = anon gets nothing

-- VIDEO_SHARE_TOKENS: Share tokens contain secrets
-- (All access goes through API routes with service role)
-- No policy for anon = anon gets nothing

-- VIDEO_ACCESS_LOGS: Contains viewer IPs and tracking data
-- (All access goes through middleware with service role)
-- No policy for anon = anon gets nothing

-- ============================================
-- 4. FIX OVERLY PERMISSIVE INSERT POLICIES ON POSTS TABLES
-- ============================================
-- Current policies: WITH CHECK (true) allows any anon user to insert.
-- Since all writes go through API routes with service role, we can
-- restrict anon INSERT while keeping SELECT open.

-- Drop overly permissive INSERT policies
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can insert comments" ON post_comments;
DROP POLICY IF EXISTS "Users can like posts" ON post_likes;
DROP POLICY IF EXISTS "Users can repost" ON post_reposts;

-- Drop UPDATE/DELETE policies that use current_setting (won't work without session var)
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can unlike their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can delete their own reposts" ON post_reposts;

-- All writes to posts tables go through service role API routes.
-- No INSERT/UPDATE/DELETE policies needed for anon/authenticated roles.
-- Service role bypasses RLS entirely.

-- ============================================
-- 5. FIX FUNCTION SEARCH_PATH WARNINGS
-- ============================================
-- Set search_path to prevent potential schema hijacking

-- update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- update_follower_counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE creators SET following_count = following_count + 1 WHERE did = NEW.follower_did;
    UPDATE creators SET follower_count = follower_count + 1 WHERE did = NEW.following_did;
    IF NEW.source = 'dragverse' THEN
      UPDATE creators SET dragverse_follower_count = dragverse_follower_count + 1 WHERE did = NEW.following_did;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE creators SET following_count = GREATEST(following_count - 1, 0) WHERE did = OLD.follower_did;
    UPDATE creators SET follower_count = GREATEST(follower_count - 1, 0) WHERE did = OLD.following_did;
    IF OLD.source = 'dragverse' THEN
      UPDATE creators SET dragverse_follower_count = GREATEST(dragverse_follower_count - 1, 0) WHERE did = OLD.following_did;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- update_video_likes
CREATE OR REPLACE FUNCTION update_video_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos SET likes = likes + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- NOTE: increment_video_views depends on video_views table.
-- It will be created/updated when supabase-migration-view-tracking.sql is run.

-- increment_post_likes
CREATE OR REPLACE FUNCTION increment_post_likes(post_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET likes = likes + 1 WHERE id = post_uuid;
END;
$$;

-- decrement_post_likes
CREATE OR REPLACE FUNCTION decrement_post_likes(post_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET likes = GREATEST(0, likes - 1) WHERE id = post_uuid;
END;
$$;

-- increment_post_comments
CREATE OR REPLACE FUNCTION increment_post_comments(post_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = post_uuid;
END;
$$;

-- increment_post_reposts
CREATE OR REPLACE FUNCTION increment_post_reposts(post_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET repost_count = repost_count + 1 WHERE id = post_uuid;
END;
$$;

-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- - All tables have RLS enabled
-- - Public content (creators, videos, follows, likes, comments) is readable by anon
-- - Private data (notifications, transactions, share tokens, access logs) blocked from anon
-- - All writes go through service role API routes (bypass RLS)
-- - Function search paths are locked down
-- - Posts tables no longer have overly permissive INSERT policies
