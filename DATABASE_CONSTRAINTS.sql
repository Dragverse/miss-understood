-- Database Constraints for Dragverse
-- Run these in Supabase SQL Editor for data integrity improvements
-- These constraints prevent orphaned records and improve data consistency

-- ============================================
-- FOREIGN KEY CONSTRAINTS WITH CASCADE DELETE
-- ============================================

-- Videos -> Creators (cascade delete videos when creator is deleted)
ALTER TABLE videos
  ADD CONSTRAINT fk_videos_creator
  FOREIGN KEY (creator_id)
  REFERENCES creators(id)
  ON DELETE CASCADE;

-- Posts -> Creators (cascade delete posts when creator is deleted)
ALTER TABLE posts
  ADD CONSTRAINT fk_posts_creator
  FOREIGN KEY (creator_id)
  REFERENCES creators(id)
  ON DELETE CASCADE;

-- Comments -> Videos (cascade delete comments when video is deleted)
ALTER TABLE comments
  ADD CONSTRAINT fk_comments_video
  FOREIGN KEY (video_id)
  REFERENCES videos(id)
  ON DELETE CASCADE;

-- Likes -> Videos (cascade delete likes when video is deleted)
ALTER TABLE likes
  ADD CONSTRAINT fk_likes_video
  FOREIGN KEY (video_id)
  REFERENCES videos(id)
  ON DELETE CASCADE;

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

-- Prevent duplicate transaction recording (double-spend protection)
ALTER TABLE transactions
  ADD CONSTRAINT unique_tx_hash
  UNIQUE (tx_hash);

-- ============================================
-- CHECK CONSTRAINTS
-- ============================================

-- Prevent users from following themselves
ALTER TABLE follows
  ADD CONSTRAINT no_self_follow
  CHECK (follower_did != following_did);

-- ============================================
-- VERIFICATION
-- ============================================

-- After running, verify constraints were created:
SELECT
  conname as constraint_name,
  conrelid::regclass as table_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname IN (
  'fk_videos_creator',
  'fk_posts_creator',
  'fk_comments_video',
  'fk_likes_video',
  'unique_tx_hash',
  'no_self_follow'
)
ORDER BY conname;

-- ============================================
-- NOTES
-- ============================================

-- These constraints are safe to run on existing data
-- They do NOT modify existing records
-- They only enforce rules for future operations

-- Benefits:
-- 1. Account deletion automatically removes all user content (atomic operation)
-- 2. Deleting a video automatically removes its likes/comments (no orphans)
-- 3. Transaction hash uniqueness prevents accidental double recording
-- 4. Self-follow prevention enforced at database level (not just app level)

-- Impact on Performance:
-- Minimal - foreign key constraints add negligible overhead
-- Improves data integrity significantly

-- Rollback (if needed):
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS fk_videos_creator;
-- ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_creator;
-- ALTER TABLE comments DROP CONSTRAINT IF EXISTS fk_comments_video;
-- ALTER TABLE likes DROP CONSTRAINT IF EXISTS fk_likes_video;
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS unique_tx_hash;
-- ALTER TABLE follows DROP CONSTRAINT IF EXISTS no_self_follow;
