# Farcaster Signer Database Migration

## Quick Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Farcaster signer UUID column to creators table
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS farcaster_signer_uuid TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_farcaster_signer
ON creators(farcaster_signer_uuid)
WHERE farcaster_signer_uuid IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN creators.farcaster_signer_uuid IS
'Neynar managed signer UUID for Farcaster cross-posting. Generated when user first connects Farcaster account.';
```

## Alternative: Use Migration File

The SQL is also available in `supabase-migrations/add-farcaster-signer.sql`

## Verify Migration

After running the migration, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'creators' 
AND column_name = 'farcaster_signer_uuid';

-- Check if index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'creators' 
AND indexname = 'idx_creators_farcaster_signer';
```

## What This Enables

- Users can register a Neynar managed signer for posting to Farcaster
- The signer UUID is stored per creator and linked to their DID
- Enables automatic cross-posting to /dragverse channel when uploading videos
