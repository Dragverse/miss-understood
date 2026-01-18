-- ============================================
-- POSTS TABLE - Native social posting with storytelling
-- ============================================

-- Posts table for photos, thoughts, and GIFs
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Content
  text_content TEXT, -- The story/caption/thought
  media_urls TEXT[], -- Array of image/GIF URLs
  media_types TEXT[], -- Array of media types ('image', 'gif', 'video')

  -- Styling & Mood
  mood TEXT, -- e.g., 'fierce', 'soft', 'dramatic', 'playful'
  background_color TEXT, -- Optional custom background for text-only posts
  text_alignment TEXT DEFAULT 'left', -- 'left', 'center', 'right'

  -- Metadata
  tags TEXT[], -- Hashtags
  mentioned_dids TEXT[], -- Tagged creators
  location TEXT, -- Optional location

  -- Privacy
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private', 'followers-only')),

  -- Engagement
  likes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ -- For scheduled posts
);

-- ============================================
-- POST COMMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Content
  text_content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE, -- For threaded replies

  -- Engagement
  likes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POST LIKES
-- ============================================

CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one like per user per post
  UNIQUE(post_id, creator_did)
);

-- ============================================
-- POST REPOSTS/SHARES
-- ============================================

CREATE TABLE IF NOT EXISTS post_reposts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Optional quote/commentary
  quote_text TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one repost per user per post
  UNIQUE(original_post_id, creator_did)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_creator_did ON posts(creator_did);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);

-- Likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_creator_did ON post_likes(creator_did);

-- Reposts indexes
CREATE INDEX IF NOT EXISTS idx_post_reposts_original_post_id ON post_reposts(original_post_id);
CREATE INDEX IF NOT EXISTS idx_post_reposts_creator_did ON post_reposts(creator_did);

-- ============================================
-- RPC FUNCTIONS FOR ATOMIC OPERATIONS
-- ============================================

-- Increment post likes
CREATE OR REPLACE FUNCTION increment_post_likes(post_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET likes = likes + 1 WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- Decrement post likes
CREATE OR REPLACE FUNCTION decrement_post_likes(post_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET likes = GREATEST(0, likes - 1) WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- Increment comment count
CREATE OR REPLACE FUNCTION increment_post_comments(post_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- Increment repost count
CREATE OR REPLACE FUNCTION increment_post_reposts(post_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET repost_count = repost_count + 1 WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reposts ENABLE ROW LEVEL SECURITY;

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can insert their own posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (creator_did = current_setting('app.current_user_did', true));
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (creator_did = current_setting('app.current_user_did', true));

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own comments" ON post_comments FOR UPDATE USING (creator_did = current_setting('app.current_user_did', true));
CREATE POLICY "Users can delete their own comments" ON post_comments FOR DELETE USING (creator_did = current_setting('app.current_user_did', true));

-- Likes policies
CREATE POLICY "Likes are viewable by everyone" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can unlike their own likes" ON post_likes FOR DELETE USING (creator_did = current_setting('app.current_user_did', true));

-- Reposts policies
CREATE POLICY "Reposts are viewable by everyone" ON post_reposts FOR SELECT USING (true);
CREATE POLICY "Users can repost" ON post_reposts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own reposts" ON post_reposts FOR DELETE USING (creator_did = current_setting('app.current_user_did', true));
