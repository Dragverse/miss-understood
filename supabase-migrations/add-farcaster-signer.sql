-- Add Farcaster signer UUID column to creators table
-- This stores the Neynar managed signer UUID for each user
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS farcaster_signer_uuid TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_farcaster_signer
ON creators(farcaster_signer_uuid)
WHERE farcaster_signer_uuid IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN creators.farcaster_signer_uuid IS
'Neynar managed signer UUID for Farcaster cross-posting. Generated when user first connects Farcaster account.';
