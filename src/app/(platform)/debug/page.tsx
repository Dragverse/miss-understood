"use client";

import { useState, useEffect } from "react";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { getVideos } from "@/lib/supabase/videos";

export default function DebugPage() {
  const { isAuthenticated, user } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const [diagnostics, setDiagnostics] = useState<any>({
    loading: true,
    timestamp: new Date().toISOString(),
    sources: {},
    user: {},
  });

  useEffect(() => {
    async function runDiagnostics() {
      const results: any = {
        loading: false,
        timestamp: new Date().toISOString(),
        sources: {},
        user: {},
      };

      // User info
      results.user = {
        authenticated: isAuthenticated,
        userId: user?.id || "Not authenticated",
      };

      // Test Supabase directly
      try {
        console.log("[Debug] Testing Supabase...");
        const supabaseVideos = await getVideos(10);
        results.sources.supabase = {
          success: true,
          count: supabaseVideos.length,
          videos: supabaseVideos.slice(0, 3).map(v => ({
            id: v.id,
            title: v.title,
            creator: v.creator_did,
          })),
        };
      } catch (error) {
        results.sources.supabase = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      // Test Bluesky API endpoint
      try {
        console.log("[Debug] Testing Bluesky API...");
        const blueskyResponse = await fetch("/api/bluesky/feed?limit=5");
        const blueskyData = await blueskyResponse.json();
        results.sources.bluesky = {
          success: blueskyResponse.ok,
          status: blueskyResponse.status,
          count: blueskyData.videos?.length || blueskyData.posts?.length || 0,
          videos: (blueskyData.videos || blueskyData.posts || []).slice(0, 3).map((v: any) => ({
            id: v.id,
            title: v.title,
            source: v.source,
          })),
          raw: blueskyData,
        };
      } catch (error) {
        results.sources.bluesky = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      // Test YouTube API endpoint
      try {
        console.log("[Debug] Testing YouTube API...");
        const youtubeResponse = await fetch("/api/youtube/feed?limit=5");
        const youtubeData = await youtubeResponse.json();
        results.sources.youtube = {
          success: youtubeResponse.ok,
          status: youtubeResponse.status,
          count: youtubeData.videos?.length || 0,
          videos: (youtubeData.videos || []).slice(0, 3).map((v: any) => ({
            id: v.id,
            title: v.title,
            source: v.source,
          })),
          warning: youtubeData.warning,
          apiKeyConfigured: youtubeData.apiKeyConfigured,
          raw: youtubeData,
        };
      } catch (error) {
        results.sources.youtube = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      // Test aggregated stats if authenticated
      if (isAuthenticated && user?.id) {
        try {
          console.log("[Debug] Testing aggregated stats...");
          const authToken = await getAccessToken();
          const statsResponse = await fetch("/api/stats/aggregate", {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          const statsData = await statsResponse.json();
          results.sources.aggregatedStats = {
            success: statsResponse.ok,
            status: statsResponse.status,
            data: statsData.stats || null,
            raw: statsData,
          };
        } catch (error) {
          results.sources.aggregatedStats = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      setDiagnostics(results);
      console.log("[Debug] Complete diagnostics:", results);
    }

    runDiagnostics();
  }, [isAuthenticated, user?.id, getAccessToken]);

  const StatusBadge = ({ success }: { success: boolean }) => (
    <span
      className={`px-2 py-1 rounded text-xs font-bold ${
        success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {success ? "✓ OK" : "✗ FAIL"}
    </span>
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
          Content Sources Debug
        </h1>
        <p className="text-gray-400 mb-8">Real-time diagnostic information</p>

        {diagnostics.loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EB83EA] mx-auto"></div>
            <p className="text-gray-400 mt-4">Running diagnostics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
              <h2 className="text-xl font-bold mb-4 text-white">User Status</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Authenticated:</span>
                  <StatusBadge success={diagnostics.user.authenticated} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">User ID:</span>
                  <code className="text-white text-xs">{diagnostics.user.userId}</code>
                </div>
              </div>
            </div>

            {/* Supabase */}
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Supabase (Dragverse Videos)</h2>
                <StatusBadge success={diagnostics.sources.supabase?.success} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Video Count:</span>
                  <span className="text-white font-bold">{diagnostics.sources.supabase?.count || 0}</span>
                </div>
                {diagnostics.sources.supabase?.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mt-2">
                    <p className="text-red-400 text-xs">{diagnostics.sources.supabase.error}</p>
                  </div>
                )}
                {diagnostics.sources.supabase?.videos && diagnostics.sources.supabase.videos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-xs mb-2">Sample videos:</p>
                    <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(diagnostics.sources.supabase.videos, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Bluesky */}
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Bluesky API</h2>
                <StatusBadge success={diagnostics.sources.bluesky?.success} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status Code:</span>
                  <span className="text-white">{diagnostics.sources.bluesky?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Video Count:</span>
                  <span className="text-white font-bold">{diagnostics.sources.bluesky?.count || 0}</span>
                </div>
                {diagnostics.sources.bluesky?.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mt-2">
                    <p className="text-red-400 text-xs">{diagnostics.sources.bluesky.error}</p>
                  </div>
                )}
                {diagnostics.sources.bluesky?.videos && diagnostics.sources.bluesky.videos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-xs mb-2">Sample videos:</p>
                    <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(diagnostics.sources.bluesky.videos, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* YouTube */}
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">YouTube API</h2>
                <StatusBadge success={diagnostics.sources.youtube?.success} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status Code:</span>
                  <span className="text-white">{diagnostics.sources.youtube?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Video Count:</span>
                  <span className="text-white font-bold">{diagnostics.sources.youtube?.count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">API Key:</span>
                  <span className={diagnostics.sources.youtube?.apiKeyConfigured ? "text-green-400" : "text-red-400"}>
                    {diagnostics.sources.youtube?.apiKeyConfigured ? "Configured ✓" : "Missing ✗"}
                  </span>
                </div>
                {diagnostics.sources.youtube?.warning && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mt-2">
                    <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Warning</p>
                    <p className="text-yellow-300 text-xs">{diagnostics.sources.youtube.warning}</p>
                    <p className="text-gray-400 text-xs mt-2">
                      Check Vercel logs or run: <code className="bg-black/30 px-1 rounded">vercel logs</code>
                    </p>
                  </div>
                )}
                {diagnostics.sources.youtube?.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mt-2">
                    <p className="text-red-400 text-xs">{diagnostics.sources.youtube.error}</p>
                  </div>
                )}
                {diagnostics.sources.youtube?.videos && diagnostics.sources.youtube.videos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-xs mb-2">Sample videos:</p>
                    <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(diagnostics.sources.youtube.videos, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Aggregated Stats */}
            {diagnostics.sources.aggregatedStats && (
              <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Aggregated Stats</h2>
                  <StatusBadge success={diagnostics.sources.aggregatedStats?.success} />
                </div>
                <div className="space-y-2 text-sm">
                  {diagnostics.sources.aggregatedStats.data && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Followers:</span>
                        <span className="text-white font-bold">
                          {diagnostics.sources.aggregatedStats.data.totalFollowers}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dragverse:</span>
                        <span className="text-white">{diagnostics.sources.aggregatedStats.data.dragverseFollowers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bluesky:</span>
                        <span className="text-[#0085ff]">{diagnostics.sources.aggregatedStats.data.blueskyFollowers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">YouTube:</span>
                        <span className="text-red-500">{diagnostics.sources.aggregatedStats.data.youtubeSubscribers}</span>
                      </div>
                    </div>
                  )}
                  {diagnostics.sources.aggregatedStats?.error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mt-2">
                      <p className="text-red-400 text-xs">{diagnostics.sources.aggregatedStats.error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Data */}
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
              <h2 className="text-xl font-bold mb-4 text-white">Complete Diagnostics (JSON)</h2>
              <pre className="bg-black/30 p-4 rounded text-xs overflow-x-auto text-gray-300">
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
