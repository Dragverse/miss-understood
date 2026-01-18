-- Dragverse Supabase Database Schema
-- Run this entire script in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CREATORS TABLE
-- ============================================
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  did TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  banner TEXT,
  description TEXT,
  website TEXT,

  -- Social handles
  twitter_handle TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  bluesky_handle TEXT,
  bluesky_did TEXT,
  farcaster_handle TEXT,

  -- Stats
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  dragverse_follower_count INTEGER DEFAULT 0,
  bluesky_follower_count INTEGER DEFAULT 0,

  -- Monetization
  verified BOOLEAN DEFAULT FALSE,
  total_earnings_usd DECIMAL(10,2) DEFAULT 0,
  stripe_account_id TEXT,
  wallet_address TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIDEOS TABLE
-- ============================================
CREATE TABLE videos (
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

  -- Privacy & Access Control
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),

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
-- VIDEO SHARING & ACCESS CONTROL
-- ============================================

-- Share tokens table - For private/unlisted video sharing
CREATE TABLE video_share_tokens (
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

-- Video access logs table - Track who accesses videos
CREATE TABLE video_access_logs (
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

-- ============================================
-- SOCIAL FEATURES (for Dragverse-only users)
-- ============================================

-- Follows table - Dragverse users can follow each other
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_did TEXT NOT NULL, -- User doing the following
  following_did TEXT NOT NULL, -- User being followed
  source TEXT DEFAULT 'dragverse', -- 'dragverse' or 'bluesky'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_did, following_did)
);

-- Likes table - Dragverse users can like videos
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_did TEXT NOT NULL, -- User who liked
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'dragverse', -- 'dragverse' or 'bluesky'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_did, video_id)
);

-- Comments table - Dragverse users can comment on videos
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  author_did TEXT NOT NULL, -- User who commented
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For nested replies
  likes INTEGER DEFAULT 0,
  source TEXT DEFAULT 'dragverse', -- 'dragverse' or 'bluesky'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table - Aggregate from Dragverse + Bluesky
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_did TEXT NOT NULL, -- User receiving the notification
  sender_did TEXT, -- User who triggered the notification (null for system notifications)
  type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'tip', 'mention', 'repost'
  source TEXT NOT NULL, -- 'dragverse' or 'bluesky'
  source_id TEXT, -- ID from source system (video_id, comment_id, etc.)
  message TEXT NOT NULL, -- Human-readable notification message
  link TEXT, -- URL to navigate to when clicked
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_creators_handle ON creators(handle);
CREATE INDEX idx_creators_did ON creators(did);
CREATE INDEX idx_videos_creator_id ON videos(creator_id);
CREATE INDEX idx_videos_creator_did ON videos(creator_did);
CREATE INDEX idx_videos_content_type ON videos(content_type);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_visibility ON videos(visibility);

-- Share token indexes
CREATE INDEX idx_share_tokens_token ON video_share_tokens(token);
CREATE INDEX idx_share_tokens_video ON video_share_tokens(video_id);
CREATE INDEX idx_share_tokens_expires ON video_share_tokens(expires_at);

-- Access log indexes
CREATE INDEX idx_access_logs_video ON video_access_logs(video_id, accessed_at DESC);
CREATE INDEX idx_access_logs_viewer ON video_access_logs(viewer_did);
CREATE INDEX idx_access_logs_ip ON video_access_logs(viewer_ip, accessed_at DESC);

-- Social feature indexes
CREATE INDEX idx_follows_follower ON follows(follower_did);
CREATE INDEX idx_follows_following ON follows(following_did);
CREATE INDEX idx_likes_user ON likes(user_did);
CREATE INDEX idx_likes_video ON likes(video_id);
CREATE INDEX idx_comments_video ON comments(video_id);
CREATE INDEX idx_comments_author ON comments(author_did);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_did);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(recipient_did, read);

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update follower counts when follows change
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE creators SET following_count = following_count + 1 WHERE did = NEW.follower_did;
    -- Increment follower count for followed user
    UPDATE creators SET follower_count = follower_count + 1 WHERE did = NEW.following_did;
    -- Increment Dragverse-specific count if source is dragverse
    IF NEW.source = 'dragverse' THEN
      UPDATE creators SET dragverse_follower_count = dragverse_follower_count + 1 WHERE did = NEW.following_did;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE creators SET following_count = GREATEST(following_count - 1, 0) WHERE did = OLD.follower_did;
    -- Decrement follower count for followed user
    UPDATE creators SET follower_count = GREATEST(follower_count - 1, 0) WHERE did = OLD.following_did;
    -- Decrement Dragverse-specific count if source is dragverse
    IF OLD.source = 'dragverse' THEN
      UPDATE creators SET dragverse_follower_count = GREATEST(dragverse_follower_count - 1, 0) WHERE did = OLD.following_did;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- Function to update video like counts
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

CREATE TRIGGER update_video_likes_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes();

-- ============================================
-- DONE!
-- ============================================
-- Your database is now ready for Dragverse!
-- Tables created: creators, videos, follows, likes, comments, notifications
-- All indexes and triggers are in place
