# Farcaster Cross-Posting Setup Guide

## ✅ What's Implemented

The complete backend for Farcaster cross-posting is now ready:

1. **Database schema** - `farcaster_signer_uuid` column
2. **Signer registration API** - `/api/farcaster/register-signer`
3. **Cast publishing API** - `/api/farcaster/post`
4. **Upload UI** - Checkbox for cross-posting

## 🔧 Setup Steps

### 1. Run Database Migration

Execute the SQL migration in your Supabase dashboard or via CLI:

```bash
# In Supabase SQL Editor or CLI:
psql $DATABASE_URL < supabase-migrations/add-farcaster-signer.sql
```

Or manually run:
```sql
ALTER TABLE creators ADD COLUMN IF NOT EXISTS farcaster_signer_uuid TEXT;
CREATE INDEX IF NOT EXISTS idx_creators_farcaster_signer
ON creators(farcaster_signer_uuid)
WHERE farcaster_signer_uuid IS NOT NULL;
```

### 2. Verify Environment Variables

Ensure these are set in Vercel:
- ✅ `NEYNAR_API_KEY` - Already configured
- ✅ `NEXT_PUBLIC_PRIVY_APP_ID` - Already configured
- ✅ `PRIVY_APP_SECRET` - Already configured

### 3. Add Signer Registration UI (Optional - Recommended)

You can trigger signer registration in two ways:

#### Option A: Auto-register on first cross-post (Current behavior)
The upload form will show an error when user tries to cross-post without a signer. You can handle this by:

1. Update `src/app/(platform)/upload/page.tsx` around line 600 (where Farcaster cross-posting happens)
2. Add automatic signer registration when `requiresSignerRegistration: true` is returned

```typescript
// In the Farcaster cross-posting section
if (farcasterError.requiresSignerRegistration) {
  // Auto-register signer
  const registerRes = await fetch("/api/farcaster/register-signer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
  });

  const registerData = await registerRes.json();

  if (registerData.success && registerData.signerApprovalUrl) {
    // Show modal with approval link
    toast.success(
      "Please approve the Farcaster signer in Warpcast to enable cross-posting",
      { duration: 10000 }
    );
    window.open(registerData.signerApprovalUrl, "_blank");
  }
}
```

#### Option B: Add "Connect Farcaster" button in Settings
Add a button in `/settings` page that calls the registration endpoint:

```typescript
// In settings page
const registerFarcasterSigner = async () => {
  try {
    const response = await fetch("/api/farcaster/register-signer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAccessToken()}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      // Open Warpcast approval URL
      window.open(data.signerApprovalUrl, "_blank");
      toast.success("Please approve the signer in Warpcast");
    }
  } catch (error) {
    toast.error("Failed to register Farcaster signer");
  }
};
```

## 🚀 How It Works

### For Users:
1. User connects Farcaster account via Privy (existing flow)
2. On first cross-post attempt, they need to register a signer:
   - Backend creates a managed signer via Neynar
   - User approves it in Warpcast (one-time, takes ~30 seconds)
   - Signer UUID is stored in database
3. Future uploads: cross-posting works automatically!

### Technical Flow:
```
User uploads video with Farcaster checkbox checked
    ↓
POST /api/farcaster/post
    ↓
Check database for signerUuid
    ↓
If no signer: Return 400 with requiresSignerRegistration flag
    ↓
Frontend calls POST /api/farcaster/register-signer
    ↓
Backend:
  1. Get user's FID from Privy
  2. Call Neynar createSigner()
  3. Store signerUuid in database
  4. Return approval URL
    ↓
User approves in Warpcast
    ↓
Future posts work automatically!
```

## 📝 API Reference

### POST /api/farcaster/register-signer
Creates a Neynar managed signer for the authenticated user.

**Headers:**
```
Authorization: Bearer <privy-access-token>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "signerUuid": "abc-123-def",
  "signerApprovalUrl": "https://client.warpcast.com/deeplinks/signed-key-request?token=...",
  "message": "Signer created successfully..."
}
```

### GET /api/farcaster/register-signer
Checks if user has a registered signer.

**Response:**
```json
{
  "success": true,
  "hasSigner": true,
  "signerUuid": "abc-123-def"
}
```

### POST /api/farcaster/post
Publishes a cast to the /dragverse channel.

**Body:**
```json
{
  "text": "Check out my new video!\n\nWatch on Dragverse: https://...",
  "videoUrl": "https://dragverse.app/watch/123",
  "imageUrl": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "cast": {
    "hash": "0xabc...",
    "url": "https://warpcast.com/~/conversations/0xabc..."
  }
}
```

## 🐛 Troubleshooting

### "Farcaster signer not registered"
- User needs to call `/api/farcaster/register-signer` first
- Implement auto-registration flow (Option A above)

### "Invalid Neynar API credentials"
- Check that `NEYNAR_API_KEY` is correct in Vercel
- Verify key is active in Neynar dashboard

### "Farcaster not connected"
- User hasn't linked Farcaster via Privy
- Direct them to Settings to connect

### Cast not appearing in /dragverse channel
- Signer may not be approved yet in Warpcast
- Check console logs for detailed error messages
- Verify the signer is registered with the correct FID

## 📚 Resources

- [Neynar Managed Signers Docs](https://docs.neynar.com/docs/how-to-let-users-connect-farcaster-accounts)
- [Privy Farcaster Integration](https://docs.privy.io/recipes/farcaster/writes)
- [Farcaster Protocol Docs](https://docs.farcaster.xyz/)

## 🎯 Next Steps

1. ✅ Run database migration
2. 🔨 Add signer registration UI (Option A or B)
3. 🧪 Test with a real Farcaster account
4. 🚀 Deploy and announce the feature!

---

**Questions?** Check the implementation in:
- `src/app/api/farcaster/register-signer/route.ts`
- `src/app/api/farcaster/post/route.ts`
- `src/app/(platform)/upload/page.tsx` (lines 1065-1078 for checkbox, 600+ for cross-posting logic)
