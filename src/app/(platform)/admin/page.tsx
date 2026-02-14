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
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

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

  const handleMigrateAudioUrls = async () => {
    if (!confirm("This will update all audio files with missing playback URLs. Continue?")) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/admin/migrate-audio-urls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json();
      setMigrationResult(result);

      if (response.ok && result.success) {
        alert(`Migration complete!\n\nUpdated: ${result.updated}\nSkipped: ${result.skipped}\nTotal: ${result.total}`);
      } else {
        alert(`Migration failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Migration error:", error);
      alert("Migration failed. Check console for details.");
      setMigrationResult({ error: String(error) });
    } finally {
      setMigrating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Please sign in to view your account info</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
          Account Info
        </h1>

        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 mb-6">
          <h2 className="text-xl font-bold mb-4 text-white">Your Privy IDs</h2>

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
                <p className="text-gray-400 text-sm font-semibold">Verified User ID (DID)</p>
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
              <strong className="text-[#EB83EA]">Note:</strong> This page shows your Privy authentication details for debugging purposes.
            </p>
          </div>
        </div>

        {/* Audio Migration Tool */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10">
          <h2 className="text-xl font-bold mb-4 text-white">Audio Migration Tool</h2>

          <p className="text-gray-300 text-sm mb-4">
            Fix existing audio files that have missing or invalid playback URLs.
            This will construct the correct downloadUrl from Livepeer asset IDs.
          </p>

          <button
            onClick={handleMigrateAudioUrls}
            disabled={migrating}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {migrating ? "Migrating..." : "Migrate Audio URLs"}
          </button>

          {migrationResult && (
            <div className={`mt-4 p-4 rounded-xl ${migrationResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className="text-sm font-semibold mb-2 text-white">
                {migrationResult.success ? "✅ Migration Complete" : "❌ Migration Failed"}
              </p>
              {migrationResult.success && (
                <div className="text-sm text-gray-300 space-y-1">
                  <p>• Updated: {migrationResult.updated} audio files</p>
                  <p>• Skipped: {migrationResult.skipped} files</p>
                  <p>• Total: {migrationResult.total} files checked</p>
                </div>
              )}
              {migrationResult.error && (
                <p className="text-sm text-red-300">{migrationResult.error}</p>
              )}
              {migrationResult.errors && migrationResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-yellow-400 cursor-pointer">
                    Show {migrationResult.errors.length} errors
                  </summary>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {migrationResult.errors.map((err: any, i: number) => (
                      <p key={i} className="text-xs text-gray-400">
                        {err.title}: {err.error}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
