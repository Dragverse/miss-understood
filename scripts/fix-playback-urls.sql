-- Fix incomplete Livepeer playback URLs in database
-- This script appends /index.m3u8 to all playback_url values that are missing it

-- Show URLs that need fixing (for verification)
SELECT
  id,
  title,
  playback_url,
  playback_url || '/index.m3u8' as fixed_url
FROM videos
WHERE playback_url IS NOT NULL
  AND playback_url != ''
  AND playback_url NOT LIKE '%/index.m3u8'
  AND playback_url NOT LIKE '%.m3u8';

-- Update all incomplete playback URLs
UPDATE videos
SET playback_url = playback_url || '/index.m3u8'
WHERE playback_url IS NOT NULL
  AND playback_url != ''
  AND playback_url NOT LIKE '%/index.m3u8'
  AND playback_url NOT LIKE '%.m3u8';

-- Verify the fix
SELECT
  id,
  title,
  playback_url
FROM videos
WHERE playback_url IS NOT NULL
  AND playback_url != ''
LIMIT 10;
