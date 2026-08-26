-- Dragverse Creator Board Schema
-- Turns the fixed-tab profile into a creator-arranged two-column board.
--
-- Layout model: two columns (0 = left, 1 = right), each an ordered stack.
-- On mobile both columns interleave into a single stack ordered by `position`,
-- so `position` must be meaningful ACROSS columns, not just within one.
--
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILE BLOCKS
-- ============================================

CREATE TABLE IF NOT EXISTS profile_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  -- Block identity. Adding a type here requires a matching entry in
  -- src/lib/blocks/registry.ts — see CREATOR_BOARD_ARCHITECTURE.md.
  type TEXT NOT NULL CHECK (type IN (
    'about',            -- bio, photo, pronouns, drag family, based-in
    'upcoming',         -- events feed (see supabase-migration-events.sql)
    'gallery',          -- photo grid
    'video_showcase',   -- pinned videos
    'music',            -- audio playlist
    'livestream',       -- live now / next stream
    'links',            -- outbound links
    'text',             -- free rich text
    'booking',          -- "book me" contact + rider info
    'embed',            -- YouTube / Bandcamp / Spotify / SoundCloud
    'featured_friends', -- other Dragverse creators
    'tip_jar',          -- USDC tipping
    'guestbook'         -- fan wall
  )),

  -- Layout. column 0 = left, 1 = right. position orders across both columns
  -- so the mobile single-column collapse stays coherent.
  column_index INTEGER NOT NULL DEFAULT 0 CHECK (column_index IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,

  -- Per-block settings. Shape is owned by the block type's Zod schema in
  -- src/lib/blocks/schemas.ts and validated on write, not by the database.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Optional creator-supplied heading, overrides the block's default title
  title TEXT,

  -- Matches the visibility vocabulary already used by posts, plus 'subscribers'
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers-only', 'subscribers', 'private')),

  -- Soft hide: keeps config around while the block is off the board
  hidden BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_blocks_creator_did ON profile_blocks(creator_did);
CREATE INDEX IF NOT EXISTS idx_profile_blocks_layout
  ON profile_blocks(creator_did, column_index, position) WHERE hidden = FALSE;

-- ============================================
-- CREATOR THEMES
-- ============================================
--
-- Deliberately NOT raw CSS. Each column maps to a CSS custom property that
-- globals.css already declares under @theme inline, scoped to the board root.
-- Constrained values keep the XSS surface at zero and guarantee every profile
-- stays legible and accessible.

CREATE TABLE IF NOT EXISTS creator_themes (
  creator_did TEXT PRIMARY KEY,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,

  -- Hex, validated app-side against a contrast floor vs. the chosen background
  accent_color TEXT,

  background_kind TEXT DEFAULT 'default'
    CHECK (background_kind IN ('default', 'color', 'gradient', 'image')),
  background_value TEXT,   -- hex | gradient token name | storage URL
  background_tile BOOLEAN DEFAULT FALSE,

  -- Named pairings from a curated set, not arbitrary font URLs
  font_pair TEXT DEFAULT 'default',

  card_style TEXT DEFAULT 'solid'
    CHECK (card_style IN ('solid', 'glass', 'outline', 'sticker')),

  -- Forces light/dark token set; NULL follows the visitor's preference
  color_scheme TEXT CHECK (color_scheme IN ('light', 'dark')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GUESTBOOK
-- ============================================
--
-- The fan wall. Separate from post_comments because entries belong to a
-- profile rather than to a piece of content.

CREATE TABLE IF NOT EXISTS guestbook_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  wall_owner_did TEXT NOT NULL,   -- whose board this was left on
  author_did TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),

  -- Owner moderation. Entries stay pending until approved when the block is
  -- configured with moderation on.
  status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'hidden')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_wall
  ON guestbook_entries(wall_owner_did, created_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_guestbook_pending
  ON guestbook_entries(wall_owner_did) WHERE status = 'pending';

-- ============================================
-- FEATURED FRIENDS
-- ============================================
--
-- Deliberately one-directional and curated: a creator picks who appears on
-- their board. This is the organic growth loop, so it is its own table rather
-- than a projection of `follows`.

CREATE TABLE IF NOT EXISTS featured_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_did TEXT NOT NULL,
  friend_did TEXT NOT NULL,
  note TEXT,                       -- "drag mother", "house sister", etc.
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_did, friend_did)
);

CREATE INDEX IF NOT EXISTS idx_featured_friends_creator
  ON featured_friends(creator_did, position);

-- ============================================
-- TRIGGERS
-- ============================================

-- Reuses update_updated_at_column() from supabase-schema.sql, which is
-- guaranteed present because these tables FK into creators.

DROP TRIGGER IF EXISTS trg_profile_blocks_updated ON profile_blocks;
CREATE TRIGGER trg_profile_blocks_updated BEFORE UPDATE ON profile_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_creator_themes_updated ON creator_themes;
CREATE TRIGGER trg_creator_themes_updated BEFORE UPDATE ON creator_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profile_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_friends ENABLE ROW LEVEL SECURITY;

-- Anon reads see public blocks only. Gated blocks are resolved server-side by
-- content-access.ts using the service role, same pattern as video access.
DROP POLICY IF EXISTS "Public blocks are viewable by everyone" ON profile_blocks;
CREATE POLICY "Public blocks are viewable by everyone" ON profile_blocks
  FOR SELECT USING (visibility = 'public' AND hidden = FALSE);

DROP POLICY IF EXISTS "Owners manage their blocks" ON profile_blocks;
CREATE POLICY "Owners manage their blocks" ON profile_blocks
  FOR ALL USING (creator_did = current_setting('app.current_user_did', true));

DROP POLICY IF EXISTS "Themes are viewable by everyone" ON creator_themes;
CREATE POLICY "Themes are viewable by everyone" ON creator_themes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage their theme" ON creator_themes;
CREATE POLICY "Owners manage their theme" ON creator_themes
  FOR ALL USING (creator_did = current_setting('app.current_user_did', true));

DROP POLICY IF EXISTS "Approved guestbook entries are public" ON guestbook_entries;
CREATE POLICY "Approved guestbook entries are public" ON guestbook_entries
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "Signed-in users can sign a guestbook" ON guestbook_entries;
CREATE POLICY "Signed-in users can sign a guestbook" ON guestbook_entries
  FOR INSERT WITH CHECK (author_did = current_setting('app.current_user_did', true));

-- Wall owners moderate; authors can retract their own entry.
DROP POLICY IF EXISTS "Wall owners moderate entries" ON guestbook_entries;
CREATE POLICY "Wall owners moderate entries" ON guestbook_entries
  FOR UPDATE USING (wall_owner_did = current_setting('app.current_user_did', true));

DROP POLICY IF EXISTS "Owners and authors delete entries" ON guestbook_entries;
CREATE POLICY "Owners and authors delete entries" ON guestbook_entries
  FOR DELETE USING (
    wall_owner_did = current_setting('app.current_user_did', true)
    OR author_did = current_setting('app.current_user_did', true)
  );

DROP POLICY IF EXISTS "Featured friends are viewable by everyone" ON featured_friends;
CREATE POLICY "Featured friends are viewable by everyone" ON featured_friends
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage featured friends" ON featured_friends;
CREATE POLICY "Owners manage featured friends" ON featured_friends
  FOR ALL USING (creator_did = current_setting('app.current_user_did', true));

-- ============================================
-- BACKFILL
-- ============================================
--
-- Every existing creator gets a default board matching today's profile layout,
-- so no profile looks empty the moment this ships. Blocks render nothing when
-- the underlying content set is empty, so this is safe for all creators.

INSERT INTO profile_blocks (creator_id, creator_did, type, column_index, position)
SELECT c.id, c.did, b.type, b.column_index, b.position
FROM creators c
CROSS JOIN (VALUES
  ('about',          0, 0),
  ('upcoming',       1, 1),
  ('video_showcase', 0, 2),
  ('music',          1, 3),
  ('gallery',        0, 4),
  ('links',          1, 5)
) AS b(type, column_index, position)
WHERE NOT EXISTS (
  SELECT 1 FROM profile_blocks pb WHERE pb.creator_did = c.did
);

COMMENT ON TABLE profile_blocks IS 'Creator-arranged board modules. Two columns; position orders across both for mobile collapse.';
COMMENT ON COLUMN profile_blocks.config IS 'Per-type settings, validated app-side by the block Zod schema. Never trusted raw.';
COMMENT ON TABLE creator_themes IS 'Constrained theme tokens mapped to globals.css custom properties. No raw CSS by design.';
