# Farcaster Native Posting Setup

This implementation allows users to post natively to Farcaster from Dragverse **without** using Neynar's paid service.

## Security Architecture

- **Encrypted Storage**: Signer private keys are encrypted using AES-256-GCM before storage
- **Environment Key**: Master encryption key stored in `FARCASTER_SIGNER_ENCRYPTION_KEY`
- **Row-Level Security**: Database policies prevent unauthorized access
- **No Third-Party**: Direct integration with Farcaster protocol (no Neynar required)

## Setup Instructions

### 1. Generate Encryption Key

Run this command to generate a secure 256-bit encryption key:

```bash
openssl rand -hex 32
```

### 2. Add to Environment Variables

Add to `.env.local`:

```bash
# Farcaster Native Posting
FARCASTER_SIGNER_ENCRYPTION_KEY=<your-generated-key>

# Optional: Custom Farcaster hub (default: nemes.farcaster.xyz:2283)
# FARCASTER_HUB_URL=your-hub-url:port
```

### 3. Run Database Migration

Run the SQL migration to create the `farcaster_signers` table:

```sql
-- Located in: supabase-migrations/farcaster_signers.sql
```

Execute in Supabase SQL Editor or via migration tool.

## User Flow

### Enabling Native Posting

1. User connects Farcaster account (via Privy) → Gets FID
2. User clicks "Enable Native Posting" in settings
3. System generates Ed25519 signer key pair
4. Private key encrypted and stored in database
5. User shown QR code / deeplink to approve signer in Warpcast
6. User opens Warpcast and approves the signer
7. System polls for approval status
8. Once approved, user can post natively to Farcaster

### Posting

When user creates a post with Farcaster enabled:
1. System retrieves encrypted signer from database
2. Decrypts private key in-memory
3. Signs cast message with Ed25519 signature
4. Broadcasts to Farcaster hub
5. Returns cast hash on success

## API Endpoints

### Create Signer

```http
POST /api/farcaster/signer/create
Authorization: Bearer <privy-jwt>

Response:
{
  "success": true,
  "publicKey": "0x...",
  "approvalUrl": "https://client.warpcast.com/...",
  "fid": 12345
}
```

### Check Signer Status

```http
GET /api/farcaster/signer/status
Authorization: Bearer <privy-jwt>

Response:
{
  "approved": true,
  "fid": 12345,
  "publicKey": "0x...",
  "message": "Signer is approved and ready for posting"
}
```

## Security Considerations

✅ **Safe Practices:**
- Private keys never exposed in API responses
- Encryption key stored in environment (not in code)
- Database uses RLS policies
- Keys encrypted at rest
- Decryption only happens in server-side code

⚠️ **Important:**
- **Never commit** `FARCASTER_SIGNER_ENCRYPTION_KEY` to version control
- **Rotate encryption key** if compromised (requires re-generating all signers)
- **Backup encryption key** securely (users can't recover signers without it)

## Troubleshooting

### "Failed to decrypt signer key"
- Check `FARCASTER_SIGNER_ENCRYPTION_KEY` is set correctly
- Verify key is 64 hex characters (32 bytes)
- Ensure same key used for encryption/decryption

### "Signer not approved"
- User must approve signer in Warpcast app first
- Check signer registration via `/api/farcaster/signer/status`
- Try re-creating signer if approval fails

### "Failed to broadcast cast"
- Check Farcaster hub connectivity (`nemes.farcaster.xyz:2283`)
- Verify user's FID is valid
- Ensure signer is properly registered

## Cost Comparison

| Method | Cost | Native Posting | Setup Complexity |
|--------|------|---------------|------------------|
| **Warpcast Redirect** (old) | FREE | ❌ No | ⭐ Easy |
| **Custom Signers** (current) | FREE | ✅ Yes | ⭐⭐⭐ Medium |
| **Neynar** | $20-50/mo | ✅ Yes | ⭐⭐ Easy |

## Files Modified

- `src/lib/farcaster/encryption.ts` - AES-256-GCM encryption utilities
- `src/lib/farcaster/signer.ts` - Signer generation, storage, and casting
- `src/lib/crosspost/farcaster.ts` - Native posting implementation
- `src/app/api/farcaster/signer/create/route.ts` - Signer creation endpoint
- `src/app/api/farcaster/signer/status/route.ts` - Status check endpoint
- `supabase-migrations/farcaster_signers.sql` - Database schema

## Next Steps

- [ ] Add UI for signer setup in settings page
- [ ] Implement QR code display for Warpcast approval
- [ ] Add signer status polling on frontend
- [ ] Handle signer expiration/rotation
- [ ] Add analytics for native posting success rate
