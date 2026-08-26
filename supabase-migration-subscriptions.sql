-- Dragverse Subscriptions Schema
-- Phase 1: free subscribe only. The tables are shaped so paid tiers are an
-- INSERT into subscription_tiers plus a payment webhook later, not a rewrite.
--
-- Why free first: the mechanic (a direct, opted-in audience + a place to put
-- content that is not for the whole internet) is what changes the product.
-- The payment rail is a separate, much more expensive decision that depends on
-- whether creators turn out to be crypto-native or not.
--
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUBSCRIPTION TIERS
-- ============================================
--
-- Every creator gets exactly one free tier at rollout. Paid tiers come later;
-- price_cents = 0 is the free case, and provider stays 'none' for it.

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  creator_did TEXT NOT NULL,

  name TEXT NOT NULL DEFAULT 'Subscribers',
  description TEXT,
  benefits TEXT[],

  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  -- Named billing_interval, not interval: the latter is a Postgres keyword and
  -- reads ambiguously in raw SQL.
  billing_interval TEXT NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('month', 'year', 'once')),

  -- 'none'  = free tier, no billing
  -- 'crypto'= USDC pass on Base, non-recurring, writes transactions rows
  -- 'stripe'= recurring via Stripe Connect
  provider TEXT NOT NULL DEFAULT 'none'
    CHECK (provider IN ('none', 'crypto', 'stripe')),
  provider_price_id TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- A paid tier must name its rail; a free tier must not
  CONSTRAINT tiers_provider_price_ck CHECK (
    (price_cents = 0 AND provider = 'none')
    OR (price_cents > 0 AND provider <> 'none')
  )
);

CREATE INDEX IF NOT EXISTS idx_tiers_creator ON subscription_tiers(creator_did, position)
  WHERE is_active = TRUE;

-- ============================================
-- SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  subscriber_did TEXT NOT NULL,
  creator_did TEXT NOT NULL,
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),

  -- NULL means it never expires — which is exactly the free tier. Crypto
  -- passes set a fixed end date; Stripe rolls this forward on each webhook.
  current_period_end TIMESTAMPTZ,

  -- Set when the subscriber cancels but the paid period has not run out yet
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,

  provider TEXT NOT NULL DEFAULT 'none'
    CHECK (provider IN ('none', 'crypto', 'stripe')),
  provider_subscription_id TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One subscription per creator per person. Re-subscribing updates in place,
  -- which keeps started_at meaningful as "supporter since".
  UNIQUE(subscriber_did, creator_did)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_id
  ON subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- The hot path: "is this viewer a subscriber of this creator right now"
CREATE INDEX IF NOT EXISTS idx_subscriptions_access
  ON subscriptions(subscriber_did, creator_did) WHERE status = 'active';

-- The creator's audience list
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator
  ON subscriptions(creator_did, started_at DESC) WHERE status = 'active';

-- Sweeper target for expiring crypto passes
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry
  ON subscriptions(current_period_end)
  WHERE status = 'active' AND current_period_end IS NOT NULL;

-- ============================================
-- SUBSCRIBER-ONLY CONTENT
-- ============================================
--
-- 'subscribers' joins the vocabulary already used by posts.visibility.
-- Enforcement lives in src/lib/middleware/content-access.ts (the generalised
-- video-access.ts), NOT in RLS, because resolving it needs a subscriptions
-- lookup under the service role.

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_visibility_check;
ALTER TABLE videos ADD CONSTRAINT videos_visibility_check
  CHECK (visibility IN ('public', 'unlisted', 'private', 'followers-only', 'subscribers'));

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IN ('public', 'unlisted', 'private', 'followers-only', 'subscribers'));

ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE stream_recordings DROP CONSTRAINT IF EXISTS stream_recordings_visibility_check;
ALTER TABLE stream_recordings ADD CONSTRAINT stream_recordings_visibility_check
  CHECK (visibility IN ('public', 'unlisted', 'private', 'followers-only', 'subscribers'));

-- Live streams can be subscriber-gated too
ALTER TABLE streams ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE streams DROP CONSTRAINT IF EXISTS streams_visibility_check;
ALTER TABLE streams ADD CONSTRAINT streams_visibility_check
  CHECK (visibility IN ('public', 'subscribers'));

-- Existing RLS SELECT policies filter on visibility = 'public', so gated rows
-- are invisible to the anon key by default. That is the correct failure mode.

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trg_tiers_updated ON subscription_tiers;
CREATE TRIGGER trg_tiers_updated BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscriptions_updated ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active tiers are viewable by everyone" ON subscription_tiers;
CREATE POLICY "Active tiers are viewable by everyone" ON subscription_tiers
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Owners manage their tiers" ON subscription_tiers;
CREATE POLICY "Owners manage their tiers" ON subscription_tiers
  FOR ALL USING (creator_did = current_setting('app.current_user_did', true));

-- A subscription is private to the two parties. No public subscriber lists.
DROP POLICY IF EXISTS "Parties can read a subscription" ON subscriptions;
CREATE POLICY "Parties can read a subscription" ON subscriptions
  FOR SELECT USING (
    subscriber_did = current_setting('app.current_user_did', true)
    OR creator_did = current_setting('app.current_user_did', true)
  );

DROP POLICY IF EXISTS "Users manage their own subscriptions" ON subscriptions;
CREATE POLICY "Users manage their own subscriptions" ON subscriptions
  FOR ALL USING (subscriber_did = current_setting('app.current_user_did', true));

-- ============================================
-- BACKFILL: one free tier per creator
-- ============================================

INSERT INTO subscription_tiers (creator_id, creator_did, name, description, price_cents, provider)
SELECT c.id, c.did, 'Subscribers', 'Get my subscriber-only posts, photos and streams.', 0, 'none'
FROM creators c
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers t WHERE t.creator_did = c.did
);

COMMENT ON TABLE subscriptions IS 'Free at phase 1. current_period_end NULL = never expires (free tier).';
COMMENT ON TABLE subscription_tiers IS 'Free tier is provider=none, price_cents=0. Paid tiers are an insert, not a migration.';
