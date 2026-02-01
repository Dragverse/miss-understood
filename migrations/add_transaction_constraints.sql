-- Migration: Add additional constraints to transactions table
-- Date: 2026-02-01

-- Add check constraint for positive amounts (max $100)
ALTER TABLE transactions
ADD CONSTRAINT check_amount_positive_and_capped
CHECK (amount_usd > 0 AND amount_usd <= 100);

-- Add check constraint for valid Ethereum addresses
ALTER TABLE transactions
ADD CONSTRAINT check_from_address_format
CHECK (from_address ~ '^0x[a-fA-F0-9]{40}$');

ALTER TABLE transactions
ADD CONSTRAINT check_to_address_format
CHECK (to_address ~ '^0x[a-fA-F0-9]{40}$');

-- Add check constraint for valid transaction hash format
ALTER TABLE transactions
ADD CONSTRAINT check_tx_hash_format
CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$');

-- Add check constraint for valid transaction types
ALTER TABLE transactions
ADD CONSTRAINT check_transaction_type
CHECK (type IN ('tip', 'purchase', 'withdrawal', 'deposit'));

-- Add check constraint for valid networks
ALTER TABLE transactions
ADD CONSTRAINT check_network_type
CHECK (network IN ('base', 'mainnet', 'optimism', 'arbitrum', 'polygon'));

-- Add comment for documentation
COMMENT ON CONSTRAINT check_amount_positive_and_capped ON transactions IS 'Ensures tip amount is positive and does not exceed $100';
COMMENT ON CONSTRAINT check_from_address_format ON transactions IS 'Validates Ethereum address format for sender';
COMMENT ON CONSTRAINT check_to_address_format ON transactions IS 'Validates Ethereum address format for recipient';
COMMENT ON CONSTRAINT check_tx_hash_format ON transactions IS 'Validates transaction hash format (0x followed by 64 hex characters)';
