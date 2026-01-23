"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export default function DebugCreatorPage() {
  const { user, getAccessToken, authenticated } = usePrivy();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDebugData() {
      if (!authenticated) {
        setLoading(false);
        setError("Not logged in");
        return;
      }

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/debug/creator", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    }

    fetchDebugData();
  }, [authenticated, getAccessToken]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug: Creator Record</h1>
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug: Creator Record</h1>

      <div className="space-y-6">
        {/* User ID */}
        <div className="bg-[#1a0b2e] rounded-xl p-6 border border-[#2f2942]">
          <h2 className="text-lg font-semibold mb-2 text-[#EB83EA]">Your User ID (DID)</h2>
          <code className="text-sm bg-black/30 p-2 rounded block break-all">
            {data?.userId || "Not found"}
          </code>
        </div>

        {/* Creator Record */}
        <div className="bg-[#1a0b2e] rounded-xl p-6 border border-[#2f2942]">
          <h2 className="text-lg font-semibold mb-2 text-[#EB83EA]">Creator Record</h2>
          {data?.creator ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {data.creator.id}</p>
              <p><strong>Handle:</strong> @{data.creator.handle}</p>
              <p><strong>Display Name:</strong> {data.creator.display_name}</p>
              <p><strong>Avatar:</strong> {data.creator.avatar || "Not set"}</p>
              <p><strong>Banner:</strong> {data.creator.banner || "Not set"}</p>
              <p><strong>Bluesky Handle:</strong> {data.creator.bluesky_handle || "Not connected"}</p>
            </div>
          ) : (
            <div className="text-red-400">
              <p>No creator record found!</p>
              <p className="text-sm text-gray-400 mt-2">
                This is why /u/salti shows "profile not found".
                Go to Settings and save your profile to create the record.
              </p>
            </div>
          )}
          {data?.creatorError && (
            <p className="text-yellow-400 mt-2">Error: {data.creatorError}</p>
          )}
        </div>

        {/* Posts */}
        <div className="bg-[#1a0b2e] rounded-xl p-6 border border-[#2f2942]">
          <h2 className="text-lg font-semibold mb-2 text-[#EB83EA]">Your Posts</h2>
          {data?.posts && data.posts.length > 0 ? (
            <div className="space-y-2">
              {data.posts.map((post: any) => (
                <div key={post.id} className="bg-black/30 p-3 rounded text-sm">
                  <p><strong>Post ID:</strong> {post.id}</p>
                  <p><strong>Creator ID linked:</strong> {post.creator_id || "❌ Missing!"}</p>
                  <p><strong>Created:</strong> {new Date(post.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No posts found</p>
          )}
        </div>

        {/* Raw Data */}
        <div className="bg-[#1a0b2e] rounded-xl p-6 border border-[#2f2942]">
          <h2 className="text-lg font-semibold mb-2 text-[#EB83EA]">Raw Data</h2>
          <pre className="text-xs bg-black/30 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
