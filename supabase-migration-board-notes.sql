-- Dragverse Creator Board — notes block
--
-- A "note" is a short written thought a creator shares on their board. It is
-- stored as a normal `posts` row with text and no media, so notes, the feed
-- and Bluesky crossposting all keep using one content model rather than
-- gaining a parallel one.
--
-- That gives the board a clean split over the same table:
--   posts WITHOUT media -> notes block
--   posts WITH    media -> gallery block
--
-- `text` stays in the enum for back-compat (it holds static prose in config)
-- but is no longer offered in the block picker.
--
-- Safe to run multiple times.

ALTER TABLE profile_blocks DROP CONSTRAINT IF EXISTS profile_blocks_type_check;

ALTER TABLE profile_blocks ADD CONSTRAINT profile_blocks_type_check CHECK (type IN (
  'about',
  'upcoming',
  'gallery',
  'video_showcase',
  'music',
  'livestream',
  'links',
  'notes',            -- new: the creator's written notes, from `posts`
  'text',             -- deprecated: static prose held in config.body
  'booking',
  'embed',
  'featured_friends',
  'tip_jar',
  'guestbook'
));

-- Give every existing board a notes block, so the feature is discoverable
-- without each creator having to find it in the picker. Blocks render nothing
-- when empty, so this is safe for creators who never write one.
INSERT INTO profile_blocks (creator_id, creator_did, type, column_index, position)
SELECT c.id, c.did, 'notes', 1,
       COALESCE((SELECT MAX(position) + 1 FROM profile_blocks pb WHERE pb.creator_did = c.did), 0)
FROM creators c
WHERE NOT EXISTS (
  SELECT 1 FROM profile_blocks pb
  WHERE pb.creator_did = c.did AND pb.type = 'notes'
);

COMMENT ON CONSTRAINT profile_blocks_type_check ON profile_blocks IS
  'Block types must have a matching entry in src/lib/blocks/registry.tsx.';
