-- Farcaster Signers Table
-- Stores encrypted Ed25519 private keys for native Farcaster posting

CREATE TABLE IF NOT EXISTS farcaster_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did TEXT NOT NULL UNIQUE, -- Privy DID
  fid INTEGER NOT NULL, -- Farcaster ID
  public_key TEXT NOT NULL, -- Ed25519 public key (hex)
  encrypted_private_key TEXT NOT NULL, -- AES-256-GCM encrypted private key
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by user DID
CREATE INDEX IF NOT EXISTS idx_farcaster_signers_user_did ON farcaster_signers(user_did);

-- Index for fast lookups by FID
CREATE INDEX IF NOT EXISTS idx_farcaster_signers_fid ON farcaster_signers(fid);

-- RLS policies
ALTER TABLE farcaster_signers ENABLE ROW LEVEL SECURITY;

-- Users can only read their own signers
CREATE POLICY "Users can read own signers"
  ON farcaster_signers
  FOR SELECT
  USING (auth.uid()::text = user_did);

-- Only service role can insert/update signers (API endpoints only)
CREATE POLICY "Service role can manage signers"
  ON farcaster_signers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_farcaster_signers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER farcaster_signers_updated_at
  BEFORE UPDATE ON farcaster_signers
  FOR EACH ROW
  EXECUTE FUNCTION update_farcaster_signers_updated_at();
