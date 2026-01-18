# Test Authentication

## Debug Steps

1. Open your browser console on https://www.dragverse.app/upload
2. Run this code in the console:

```javascript
// Get the access token
const getToken = async () => {
  // This assumes Privy is available
  const privy = window.__PRIVY__; // Try to access Privy global

  // Or try getting from localStorage
  const privyData = Object.keys(localStorage)
    .filter(key => key.includes('privy'))
    .map(key => ({ key, value: localStorage.getItem(key) }));

  console.log('Privy localStorage keys:', privyData);

  // Try to get token from Privy context
  console.log('Checking for Privy token...');
};

getToken();
```

3. Then test the auth endpoint:

```javascript
// Test the debug endpoint
fetch('/api/auth/debug', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(data => console.log('Auth debug response:', data));
```

## Alternative: Check Network Tab

1. Open DevTools → Network tab
2. Try uploading a video
3. Find the `upload/request` request that fails with 401
4. Check the Request Headers
5. Copy the `Authorization: Bearer ...` token
6. Paste it here for analysis

## What to Check in Vercel

Go to: https://vercel.com/dashboard

1. Find your project (miss-understood or dragverse)
2. Go to Settings → Environment Variables
3. **Verify these are set for Production:**
   - `NEXT_PUBLIC_PRIVY_APP_ID` = `cm4p349iz06p2n6f07djtb3rw`
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vrjzqcqrpkeegufimfhv.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)

4. **If any are missing, add them and redeploy**

## Common Issues

### Issue 1: Environment Variable Not Set
- **Symptom:** Server logs show "Privy not configured"
- **Fix:** Add `NEXT_PUBLIC_PRIVY_APP_ID` to Vercel environment variables

### Issue 2: Token is Expired
- **Symptom:** Token looks valid but verification fails
- **Fix:** Sign out and sign back in to get a fresh token

### Issue 3: Wrong App ID
- **Symptom:** Token is for different Privy app
- **Fix:** Verify app ID matches in both client and server

### Issue 4: JWKS Endpoint Unreachable
- **Symptom:** Verification fails with network error
- **Fix:** Check if Privy's JWKS endpoint is accessible from Vercel

## Next Steps

Based on the error, it seems like:
1. Client successfully gets a token ✅
2. Client sends token to server ✅
3. Server receives token ✅
4. **Server fails to verify token with Privy** ❌

This means either:
- Token is expired/invalid
- Wrong app ID on server
- JWKS verification failing
- Token format is wrong

Run the debug steps above to narrow down the issue.
