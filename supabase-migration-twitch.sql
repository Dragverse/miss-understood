-- Dragverse — Twitch handle and follower count
--
-- Twitch only needs a username: the follower total is readable with an app
-- access token, so there's no per-creator OAuth, no app review and no
-- account-type requirement. See src/lib/twitch/client.ts.
--
-- Purely additive. Safe to run multiple times.

ALTER TABLE creators ADD COLUMN IF NOT EXISTS twitch_handle TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS twitch_follower_count INTEGER DEFAULT 0;

COMMENT ON COLUMN creators.twitch_handle IS
  'Twitch username (no @). All the Helix API needs to resolve followers and live status.';
COMMENT ON COLUMN creators.twitch_follower_count IS
  'Cached Twitch follower total, refreshed by /api/stats/aggregate. Counts toward follower_count.';
