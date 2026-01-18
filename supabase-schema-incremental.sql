-- Dragverse Supabase Database Schema (Incremental)
-- This version skips tables that already exist

-- Enable UUID extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- VIDEOS TABLE (create only if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Video info
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,

  -- Livepeer integration
  livepeer_asset_id TEXT,
  playback_id TEXT,
  playback_url TEXT,

  -- Metadata
  duration INTEGER, -- seconds
  content_type TEXT CHECK (content_type IN ('short', 'long', 'podcast', 'music', 'live')),
  category TEXT,
  tags TEXT[], -- Array of strings

  -- Stats
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  tip_count INTEGER DEFAULT 0,
  total_tips_usd DECIMAL(10,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL FEATURES
-- ============================================

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_did TEXT NOT NULL,
  following_did TEXT NOT NULL,
  source TEXT DEFAULT 'dragverse',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_did, following_did)
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_did TEXT NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'dragverse',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_did, video_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  author_did TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  source TEXT DEFAULT 'dragverse',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_did TEXT NOT NULL,
  sender_did TEXT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (safe to run - will skip if exists)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_creators_handle ON creators(handle);
CREATE INDEX IF NOT EXISTS idx_creators_did ON creators(did);
CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_creator_did ON videos(creator_did);
CREATE INDEX IF NOT EXISTS idx_videos_content_type ON videos(content_type);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_did);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_did);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_did);
CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_did);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_did);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipient_did, read);

-- ============================================
-- TRIGGERS (safe to run - will replace if exists)
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist, then recreate
DROP TRIGGER IF EXISTS update_creators_updated_at ON creators;
CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Follower counts trigger
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_follower_counts_trigger ON follows;
CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- Video likes trigger
CREATE OR REPLACE FUNCTION update_video_likes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos SET likes = likes + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_video_likes_trigger ON likes;
CREATE TRIGGER update_video_likes_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes();

-- ============================================
-- DONE!
-- ============================================
-- Run this script in Supabase SQL Editor
-- It will only create missing tables and update triggers
