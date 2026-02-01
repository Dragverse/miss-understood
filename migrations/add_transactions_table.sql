-- Migration: Add transactions table for tip tracking
-- Date: 2026-01-31

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  tx_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'tip', 'purchase', etc.
  network TEXT NOT NULL DEFAULT 'base',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);

-- Add wallet_address column to creators table if not exists
ALTER TABLE creators ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet_address);

-- Add comment for documentation
COMMENT ON TABLE transactions IS 'Stores all blockchain transactions including tips and purchases';
COMMENT ON COLUMN transactions.token IS 'Token used for transaction (USDC, ETH, etc.)';
COMMENT ON COLUMN transactions.type IS 'Type of transaction: tip, purchase, etc.';
COMMENT ON COLUMN transactions.network IS 'Blockchain network: base, mainnet, etc.';
