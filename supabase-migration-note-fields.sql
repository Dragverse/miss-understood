-- Dragverse — note fields
--
-- Gives a note the shape the board actually renders: a title, an optional
-- outbound link, an optional expiry, and a display style.
--
-- Purely additive. No DROP CONSTRAINT on a live table this time — the only
-- new constraint is on a column that didn't exist a moment ago, so there is
-- nothing to clobber.
--
-- Safe to run multiple times.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS title      TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_url   TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_label TEXT;

-- Notes can be set to disappear on their own — a drop, a limited offer, a
-- door list. Filtered on read rather than deleted, so the creator keeps the
-- record and nothing vanishes irrecoverably.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 'quote' renders as large display type on the deeper magenta; 'card' is the
-- normal titled note.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS note_style TEXT DEFAULT 'card';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_note_style_check'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_note_style_check
      CHECK (note_style IN ('card', 'quote'));
  END IF;
END $$;

-- The public read path filters on expiry, so index the common case.
CREATE INDEX IF NOT EXISTS idx_posts_unexpired
  ON posts (created_at DESC)
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_expiring
  ON posts (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN posts.expires_at IS
  'When set, the note stops appearing in public reads after this time. Never deleted — the creator still sees it.';
COMMENT ON COLUMN posts.note_style IS
  'card = titled note; quote = large display type. See src/components/notes/note-card.tsx.';
