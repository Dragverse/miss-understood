-- Dragverse — drop Farcaster from the watcher total
--
-- creators.follower_count is the cached cross-platform aggregate that both the
-- profile and the dashboard read. /api/stats/aggregate now computes it without
-- Farcaster (see FARCASTER_UI_ENABLED in src/config/features.ts), but existing
-- rows still carry the old total, so they need recomputing once.
--
-- Farcaster's own column is left intact: the data is still collected and the
-- posting integration is untouched. This only changes the headline number.
--
-- Safe to run multiple times — it recomputes from the per-platform columns
-- rather than subtracting, so running it twice gives the same answer.

UPDATE creators
SET follower_count =
      COALESCE(dragverse_follower_count, 0)
    + COALESCE(bluesky_follower_count, 0)
    + COALESCE(youtube_subscriber_count, 0),
    updated_at = NOW()
WHERE follower_count IS DISTINCT FROM (
      COALESCE(dragverse_follower_count, 0)
    + COALESCE(bluesky_follower_count, 0)
    + COALESCE(youtube_subscriber_count, 0)
);

COMMENT ON COLUMN creators.follower_count IS
  'Cached watcher total: Dragverse + Bluesky + YouTube. Farcaster is deliberately excluded — see FARCASTER_UI_ENABLED. Maintained by /api/stats/aggregate; read it, never re-sum it in a component.';
