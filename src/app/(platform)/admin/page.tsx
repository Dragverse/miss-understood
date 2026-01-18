"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";

export default function AdminPage() {
  const { isAuthenticated, user, userHandle } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const [verifiedUserId, setVerifiedUserId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Cleanup state
  const [cleanupPreview, setCleanupPreview] = useState<Record<string, unknown> | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function loadVerifiedId() {
      if (!user?.id) return;

      try {
        const authToken = await getAccessToken();
        const meResponse = await fetch("/api/user/me", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (meResponse.ok) {
          const meData = await meResponse.json();
          setVerifiedUserId(meData.userId);
        }
      } catch (error) {
        console.error("Failed to get verified user ID:", error);
      }
    }

    if (isAuthenticated && user?.id) {
      loadVerifiedId();
    }
  }, [isAuthenticated, user?.id, getAccessToken]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadCleanupPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch("/api/admin/cleanup-test-users");
      const data = await response.json();
      setCleanupPreview(data);
    } catch (error) {
      console.error("Failed to load cleanup preview:", error);
      alert("Failed to load cleanup preview");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const executeCleanup = async () => {
    if (!confirm(`Are you sure you want to delete ${cleanupPreview?.summary?.testUsersToDelete || 0} test users? This cannot be undone!`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/cleanup-test-users", {
        method: "DELETE",
      });
      const data = await response.json();
      setCleanupResult(data);

      if (data.success) {
        alert(`Successfully deleted ${data.summary.testUsersDeleted} test users!`);
        // Reload preview
        loadCleanupPreview();
      } else {
        alert(`Cleanup failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
      alert("Cleanup operation failed");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Please sign in to view admin info</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
          Admin Info
        </h1>

        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 mb-6">
          <h2 className="text-xl font-bold mb-4 text-white">Your User IDs</h2>

          <div className="space-y-4">
            {/* Client User ID */}
            <div className="bg-[#2f2942]/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm font-semibold">Client User ID</p>
                <button
                  onClick={() => copyToClipboard(user?.id || "")}
                  className="text-[#EB83EA] hover:text-[#E748E6] transition-colors"
                >
                  {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                </button>
              </div>
              <code className="text-white text-sm break-all">{user?.id}</code>
            </div>

            {/* Verified User ID (DID) */}
            <div className="bg-[#2f2942]/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm font-semibold">Verified User ID (DID) - Use this for verification ⭐</p>
                <button
                  onClick={() => copyToClipboard(verifiedUserId)}
                  className="text-[#EB83EA] hover:text-[#E748E6] transition-colors"
                >
                  {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                </button>
              </div>
              <code className="text-white text-sm break-all">{verifiedUserId || "Loading..."}</code>
            </div>

            {/* Handle */}
            {userHandle && (
              <div className="bg-[#2f2942]/40 rounded-xl p-4">
                <p className="text-gray-400 text-sm font-semibold mb-2">Handle</p>
                <code className="text-white text-sm">@{userHandle}</code>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-[#EB83EA]/10 border border-[#EB83EA]/20 rounded-xl">
            <p className="text-sm text-gray-300">
              <strong className="text-[#EB83EA]">To get verified:</strong> Copy the &ldquo;Verified User ID (DID)&rdquo; above and add it to{" "}
              <code className="bg-[#2f2942]/60 px-2 py-1 rounded">src/config/verified-creators.ts</code>
            </p>
          </div>
        </div>

        {/* Database Cleanup Section */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
          <h2 className="text-xl font-bold mb-4 text-white">Database Cleanup</h2>

          <p className="text-gray-400 text-sm mb-4">
            Remove test users from the database. Only keeps real Privy users (DIDs starting with &ldquo;did:privy:&rdquo;).
          </p>

          <button
            onClick={loadCleanupPreview}
            disabled={isLoadingPreview}
            className="w-full px-4 py-3 bg-[#2f2942] hover:bg-[#3f3952] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors mb-4"
          >
            {isLoadingPreview ? "Loading..." : "Preview Cleanup"}
          </button>

          {cleanupPreview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-[#2f2942]/40 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Creators:</span>
                    <span className="text-white font-mono">{cleanupPreview.summary.totalCreators}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Real Users (Keep):</span>
                    <span className="text-green-400 font-mono">{cleanupPreview.summary.realUsersToKeep}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Test Users (Delete):</span>
                    <span className="text-red-400 font-mono">{cleanupPreview.summary.testUsersToDelete}</span>
                  </div>
                </div>
              </div>

              {/* Test Users to Delete */}
              {cleanupPreview.testUsers && Array.isArray(cleanupPreview.testUsers) && cleanupPreview.testUsers.length > 0 && (
                <div className="bg-[#2f2942]/40 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3">Test Users to Delete</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {cleanupPreview.testUsers.map((user: Record<string, unknown>) => (
                      <div key={String(user.id)} className="text-xs bg-[#18122D]/60 rounded p-2">
                        <div className="text-red-400 font-mono">{String(user.handle)}</div>
                        <div className="text-gray-500">{String(user.displayName)}</div>
                        <div className="text-gray-600 text-[10px] truncate">{String(user.did)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real Users to Keep */}
              {cleanupPreview.realUsers && Array.isArray(cleanupPreview.realUsers) && cleanupPreview.realUsers.length > 0 && (
                <div className="bg-[#2f2942]/40 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3">Real Users (Will Keep)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {cleanupPreview.realUsers.map((user: Record<string, unknown>) => (
                      <div key={String(user.did)} className="text-xs bg-[#18122D]/60 rounded p-2">
                        <div className="text-green-400 font-mono">{String(user.handle)}</div>
                        <div className="text-gray-400">{String(user.displayName)}</div>
                        <div className="text-gray-600 text-[10px] truncate">{String(user.did)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete Button */}
              {cleanupPreview.summary && typeof cleanupPreview.summary === 'object' &&
               'testUsersToDelete' in cleanupPreview.summary &&
               Number(cleanupPreview.summary.testUsersToDelete) > 0 && (
                <button
                  onClick={executeCleanup}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                >
                  {isDeleting ? "Deleting..." : `Delete ${Number(cleanupPreview.summary.testUsersToDelete)} Test Users`}
                </button>
              )}

              {cleanupPreview.summary && typeof cleanupPreview.summary === 'object' &&
               'testUsersToDelete' in cleanupPreview.summary &&
               Number(cleanupPreview.summary.testUsersToDelete) === 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                  <p className="text-green-400 font-semibold">✓ No test users found!</p>
                </div>
              )}
            </div>
          )}

          {cleanupResult && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-green-400 font-semibold">
                ✓ {cleanupResult.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
