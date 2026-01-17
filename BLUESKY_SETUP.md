# Setting Up Bluesky Content Feed

To populate your Dragverse feed with content from Bluesky, you need to authenticate with a Bluesky account.

## Quick Setup (5 minutes)

### Step 1: Create a Bluesky Account (if you don't have one)

1. Go to https://bsky.app
2. Sign up for a free account
3. Choose a handle (e.g., `dragverse.bsky.social`)

### Step 2: Create an App Password

1. Go to https://bsky.app/settings/app-passwords
2. Click "Add App Password"
3. Give it a name like "Dragverse Feed"
4. Copy the generated password (you can't see it again!)

### Step 3: Add Credentials to Your Environment

1. Open your `.env.local` file (create it if it doesn't exist)
2. Add these lines:

```env
BLUESKY_IDENTIFIER=yourhandle.bsky.social
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Replace `yourhandle.bsky.social` with your actual handle and the password with the app password you just created.

### Step 4: Restart Your Dev Server

```bash
# Stop the current server (Ctrl+C)
# Start it again
npm run dev
```

### Step 5: Verify It's Working

1. Open http://localhost:3000
2. Open browser console (F12)
3. You should see: `Loaded X videos from Bluesky`
4. Videos should have a blue Bluesky badge in the corner

## What Videos Will Show?

By default, the feed attempts to fetch recent posts from drag-related accounts on Bluesky:
- @rupaulsdragrace.bsky.social
- @drag.bsky.social
- @dragqueen.bsky.social
- @queendom.bsky.social
- @lgbtq.bsky.social

**Note**: Some of these accounts may not exist yet or may not have video content. The feed will skip accounts that don't exist and only show videos from available sources.

### Customizing the Feed

Edit `/src/lib/bluesky/client.ts` (lines 87-95) to add more accounts:

```typescript
const dragAccounts = [
  "yourfavorite.bsky.social", // Add any Bluesky handle here
  "anotherdragqueen.bsky.social",
];
```

### Finding Real Drag Accounts on Bluesky

1. Go to https://bsky.app and search for drag performers
2. Look for verified accounts or accounts with followers
3. Copy their handle (e.g., `username.bsky.social`)
4. Add to the `dragAccounts` array in the code above

## Troubleshooting

### "Authentication Required" errors

- **Check credentials**: Make sure `BLUESKY_IDENTIFIER` and `BLUESKY_APP_PASSWORD` are in `.env.local`
- **Restart server**: Changes to `.env.local` require a server restart
- **Verify password**: App passwords are different from your regular password

### No videos appearing

- **Check console**: Look for error messages in browser console (F12)
- **Verify accounts**: Some accounts may not have video posts
- **API limits**: Bluesky has rate limits (~3000 requests per 5 minutes)

### Videos but no thumbnails

- Some Bluesky posts don't have preview images
- This is normal - the code handles it gracefully

## Without Bluesky Credentials

If you don't set up Bluesky credentials:
- The feed will show mock data instead
- No error will occur
- You can still develop and test everything else

The Bluesky integration is **optional** - it just helps populate your feed while you're building your user base.

## Security Notes

✅ **App passwords are safe**:
- They're different from your main password
- You can revoke them anytime
- They're scoped to API access only

✅ **Never commit credentials**:
- `.env.local` is in `.gitignore`
- Never share your app password publicly

✅ **For production**:
- Create a dedicated Bluesky account for your service
- Use a strong, unique password
- Rotate app passwords periodically

## Next Steps

Once Bluesky feed is working, you can:
1. Add more drag queen accounts to follow
2. Implement caching to reduce API calls
3. Add user preferences for which accounts to show
4. Create your own curated feeds

See `BLUESKY_INTEGRATION.md` for more advanced customization options.
