-- Dragverse Events Schema
-- Gigs, shows, livestreams and premieres as ONE scheduling primitive.
--
-- Today there are three parallel "something happens later" mechanisms:
--   1. streams.scheduled_at            (supabase-migration-scheduled-streams.sql)
--   2. videos.published_at in future   (supabase-migration-premiere.sql)
--   3. posts.scheduled_at              (supabase-posts-schema.sql)
--
-- This table becomes the single surface a fan reads. Online events point at
-- the row that actually does the work (stream_id / video_id) rather than
-- duplicating it, so /live/[handle] and /premiere/[id] keep working unchanged
-- and simply gain an events row alongside them.
--
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  title TEXT NOT NULL,
  description TEXT,
  flyer_url TEXT,

  kind TEXT NOT NULL DEFAULT 'gig' CHECK (kind IN (
    'gig',        -- a booking at a venue
    'show',       -- own production
    'livestream', -- online, backed by streams
    'premiere',   -- online, backed by videos
    'workshop',
    'other'
  )),

  -- Timing. Always store UTC in starts_at/ends_at; `timezone` is the IANA zone
  -- the creator entered it in, needed to render "10pm local" correctly and to
  -- emit valid .ics. Do not derive one from the other.
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

  -- Place. All NULL for online events.
  venue_name TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,          -- ISO 3166-1 alpha-2
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Online events link to the thing that actually streams/plays
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,

  -- Tickets. price_text is free-form on purpose ("£8 adv / £10 door",
  -- "donation", "free") because door policies do not fit a numeric column.
  ticket_url TEXT,
  price_text TEXT,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  age_restriction TEXT,   -- '18+', '21+', 'all ages'

  -- Who else is on. Free text so non-Dragverse performers can be credited;
  -- lineup_dids links the ones who are on the platform.
  lineup TEXT[],
  lineup_dids TEXT[],
  host_name TEXT,

  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers-only', 'subscribers', 'private')),

  cancelled_at TIMESTAMPTZ,
  cancellation_note TEXT,

  -- Set when the event came from an import (Bluesky post, .ics feed) rather
  -- than the composer, so re-imports update instead of duplicating.
  source TEXT NOT NULL DEFAULT 'dragverse',
  source_ref TEXT,

  interested_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- An online event should point at exactly one backing record
  CONSTRAINT events_online_backing_ck CHECK (
    NOT (stream_id IS NOT NULL AND video_id IS NOT NULL)
  ),
  CONSTRAINT events_time_order_ck CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Idempotent imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_ref
  ON events(source, source_ref) WHERE source_ref IS NOT NULL;

-- "What's next for this creator" — the profile Upcoming block
CREATE INDEX IF NOT EXISTS idx_events_creator_upcoming
  ON events(creator_did, starts_at) WHERE cancelled_at IS NULL;

-- "What's on in my city" — the /events discovery page
CREATE INDEX IF NOT EXISTS idx_events_city_upcoming
  ON events(country, city, starts_at)
  WHERE cancelled_at IS NULL AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_lineup_dids ON events USING GIN(lineup_dids);

-- ============================================
-- EVENT INTERESTS
-- ============================================
--
-- Intentionally not called RSVP: Dragverse is not the ticketing system of
-- record. This is a reminder subscription plus a soft popularity signal.

CREATE TABLE IF NOT EXISTS event_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_did TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'going')),
  notify BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_did)
);

CREATE INDEX IF NOT EXISTS idx_event_interests_user ON event_interests(user_did);
CREATE INDEX IF NOT EXISTS idx_event_interests_event ON event_interests(event_id);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trg_events_updated ON events;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION sync_event_interested_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET interested_count = interested_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET interested_count = GREATEST(interested_count - 1, 0) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_interests_count ON event_interests;
CREATE TRIGGER trg_event_interests_count
  AFTER INSERT OR DELETE ON event_interests
  FOR EACH ROW EXECUTE FUNCTION sync_event_interested_count();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
CREATE POLICY "Public events are viewable by everyone" ON events
  FOR SELECT USING (visibility = 'public');

DROP POLICY IF EXISTS "Owners manage their events" ON events;
CREATE POLICY "Owners manage their events" ON events
  FOR ALL USING (creator_did = current_setting('app.current_user_did', true));

DROP POLICY IF EXISTS "Interests are viewable by everyone" ON event_interests;
CREATE POLICY "Interests are viewable by everyone" ON event_interests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage their own interest" ON event_interests;
CREATE POLICY "Users manage their own interest" ON event_interests
  FOR ALL USING (user_did = current_setting('app.current_user_did', true));

-- ============================================
-- BACKFILL: existing scheduled streams become events
-- ============================================

-- streams.scheduled_at only exists where supabase-migration-scheduled-streams.sql
-- has been applied. Guard on the column rather than assuming: the Supabase SQL
-- editor runs a script as ONE transaction, so an unguarded reference to a
-- missing column rolls back this entire migration, tables included.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'streams'
      AND column_name = 'scheduled_at'
  ) THEN
    EXECUTE $backfill$
      INSERT INTO events (creator_did, title, description, flyer_url, kind, starts_at, stream_id, source, source_ref)
      SELECT s.creator_did, s.title, s.description, s.thumbnail, 'livestream', s.scheduled_at, s.id, 'stream_backfill', s.id::text
      FROM streams s
      WHERE s.scheduled_at IS NOT NULL
      ON CONFLICT DO NOTHING
    $backfill$;
    RAISE NOTICE 'Backfilled scheduled streams into events.';
  ELSE
    RAISE NOTICE 'streams.scheduled_at not present — skipping stream backfill.';
  END IF;
END $$;

COMMENT ON TABLE events IS 'Single scheduling primitive: gigs, shows, livestreams, premieres. Online events reference streams/videos rather than duplicating them.';
COMMENT ON COLUMN events.timezone IS 'IANA zone the creator entered the time in. Required for correct local rendering and .ics output.';
COMMENT ON COLUMN events.price_text IS 'Free-form on purpose. Door policies ("£8 adv / £10 door") do not fit a numeric column.';
