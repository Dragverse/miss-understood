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
              <strong className="text-[#EB83EA]">To get verified:</strong> Copy the "Verified User ID (DID)" above and add it to{" "}
              <code className="bg-[#2f2942]/60 px-2 py-1 rounded">src/config/verified-creators.ts</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
