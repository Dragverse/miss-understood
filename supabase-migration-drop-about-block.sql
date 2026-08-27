-- Dragverse Creator Board — remove the About block
--
-- The profile header already shows the bio, handle, badges and stats above the
-- board, so an About block repeated the same information a few hundred pixels
-- lower. Removed rather than hidden: there is nothing a creator would want to
-- configure differently between the two.
--
-- Positions are left as-is. They only need to be increasing, not contiguous —
-- the board sorts by `position` and the reorder endpoint reindexes from 0 on
-- the next drag, so a gap is harmless.
--
-- Safe to run multiple times.

DELETE FROM profile_blocks WHERE type = 'about';

-- Drop 'about' from the allowed types so it can't come back.
ALTER TABLE profile_blocks DROP CONSTRAINT IF EXISTS profile_blocks_type_check;

ALTER TABLE profile_blocks ADD CONSTRAINT profile_blocks_type_check CHECK (type IN (
  'upcoming',
  'gallery',
  'video_showcase',
  'music',
  'livestream',
  'links',
  'notes',
  'text',             -- deprecated: static prose held in config.body
  'booking',
  'embed',
  'featured_friends',
  'tip_jar',
  'guestbook'
));

COMMENT ON CONSTRAINT profile_blocks_type_check ON profile_blocks IS
  'Block types must have a matching entry in src/lib/blocks/registry.tsx.';
