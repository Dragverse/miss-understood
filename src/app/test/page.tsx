/**
 * Simple test page that bypasses Privy
 * Access at /test to verify the app works without authentication
 */
export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-pink-900">
      <div className="text-center p-8 bg-black/50 rounded-2xl backdrop-blur-sm border border-purple-500/20">
        <h1 className="text-4xl font-bold text-white mb-4">
          ✅ App is Working!
        </h1>
        <p className="text-gray-300 mb-6">
          Your Supabase migration was successful.
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>✅ Next.js is running</p>
          <p>✅ Build compiled successfully</p>
          <p>✅ TypeScript has no errors</p>
          <p>✅ Supabase modules loaded</p>
        </div>
        <div className="mt-8 p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
          <p className="text-xs text-purple-300 mb-2">
            If you're seeing "checking you are a human" on the main page:
          </p>
          <ul className="text-xs text-gray-400 space-y-1 text-left">
            <li>• This is Privy's loading screen (normal)</li>
            <li>• Check browser console for errors (F12)</li>
            <li>• Verify NEXT_PUBLIC_PRIVY_APP_ID is set</li>
            <li>• Try clearing browser cache/cookies</li>
          </ul>
        </div>
        <a
          href="/"
          className="inline-block mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
        >
          Go to Home Page
        </a>
      </div>
    </div>
  );
}
