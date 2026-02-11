"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { SiFarcaster } from "react-icons/si";
import { FiCheck, FiLoader, FiAlertCircle, FiMaximize } from "react-icons/fi";
import toast from "react-hot-toast";

export function FarcasterSignerSetup() {
  const { getAccessToken } = usePrivy();
  const [signerStatus, setSignerStatus] = useState<{
    exists: boolean;
    approved: boolean;
    approvalUrl?: string;
    loading: boolean;
  }>({
    exists: false,
    approved: false,
    loading: true,
  });
  const [creating, setCreating] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    checkSignerStatus();
  }, []);

  const checkSignerStatus = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/farcaster/signer/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Farcaster Setup] Status check:", data);

        setSignerStatus({
          exists: true,
          approved: data.approved,
          approvalUrl: data.approvalUrl, // Get approval URL from status
          loading: false,
        });

        if (data.approved) {
          toast.success("Farcaster signer approved! ✅");
        }
      } else {
        setSignerStatus({
          exists: false,
          approved: false,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Failed to check signer status:", error);
      setSignerStatus({
        exists: false,
        approved: false,
        loading: false,
      });
    }
  };

  const createSigner = async () => {
    setCreating(true);
    const loadingToast = toast.loading("Creating Farcaster signer...");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/farcaster/signer/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();

        console.log("[Farcaster Setup] Signer created:", data);
        console.log("[Farcaster Setup] Approval URL:", data.approvalUrl);

        toast.success("Signer created! Opening Warpcast for approval...", {
          id: loadingToast,
          duration: 5000,
        });

        // Open Warpcast approval URL
        const newWindow = window.open(data.approvalUrl, "_blank");

        if (!newWindow) {
          toast.error("Popup blocked! Please allow popups and try again.", {
            duration: 5000,
          });
          console.error("[Farcaster Setup] Popup blocked. URL:", data.approvalUrl);
        }

        // Update state
        setSignerStatus({
          exists: true,
          approved: false,
          approvalUrl: data.approvalUrl,
          loading: false,
        });

        // Start polling for approval
        pollForApproval();
      } else {
        const error = await response.json();
        console.error("[Farcaster Setup] API error:", error);
        toast.error(error.message || error.error || "Failed to create signer", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Failed to create signer:", error);
      toast.error("Failed to create signer. Please try again.", {
        id: loadingToast,
      });
    } finally {
      setCreating(false);
    }
  };

  const pollForApproval = async () => {
    const maxAttempts = 30; // 30 attempts = 5 minutes
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error(
          "Approval timeout. Please check Warpcast and refresh this page."
        );
        return;
      }

      attempts++;

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/farcaster/signer/status", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.approved) {
            toast.success("Farcaster signer approved! You can now post natively.");
            setSignerStatus({
              exists: true,
              approved: true,
              loading: false,
            });
            return;
          }
        }
      } catch (error) {
        console.error("Poll error:", error);
      }

      // Poll again in 10 seconds
      setTimeout(poll, 10000);
    };

    poll();
  };

  if (signerStatus.loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <FiLoader className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking signer status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-purple-600/20 rounded-lg">
          <SiFarcaster className="w-6 h-6 text-purple-400" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold mb-2">Native Farcaster Posting</h3>

          {!signerStatus.exists && (
            <>
              <p className="text-gray-400 text-sm mb-4">
                Enable native posting to Farcaster without manual Warpcast
                redirects. Your signer keys are encrypted and stored securely.
              </p>

              <button
                onClick={createSigner}
                disabled={creating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    <span>Creating Signer...</span>
                  </>
                ) : (
                  <>
                    <SiFarcaster className="w-4 h-4" />
                    <span>Enable Native Posting</span>
                  </>
                )}
              </button>
            </>
          )}

          {signerStatus.exists && !signerStatus.approved && (
            <>
              <p className="text-yellow-400 text-sm mb-3 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4" />
                Waiting for approval in Warpcast
              </p>

              <p className="text-gray-400 text-sm mb-4">
                Your signer has been created but needs approval. Open Warpcast
                and approve the signer request to enable native posting.
              </p>

              <div className="flex flex-wrap gap-3 mb-4">
                {signerStatus.approvalUrl && (
                  <>
                    <a
                      href={signerStatus.approvalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <SiFarcaster className="w-4 h-4" />
                      <span>Open Warpcast</span>
                    </a>

                    <button
                      onClick={() => setShowQR(!showQR)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FiMaximize className="w-4 h-4" />
                      <span>{showQR ? "Hide" : "Show"} QR Code</span>
                    </button>
                  </>
                )}

                <button
                  onClick={checkSignerStatus}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors"
                >
                  Check Status
                </button>
              </div>

              {showQR && signerStatus.approvalUrl && (
                <div className="bg-white p-4 rounded-lg mb-4 flex flex-col items-center">
                  <p className="text-sm text-gray-600 mb-3 text-center">
                    Scan this QR code with your phone to approve in Warpcast
                  </p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(signerStatus.approvalUrl)}`}
                    alt="Warpcast Approval QR Code"
                    className="w-[200px] h-[200px]"
                  />
                  <p className="text-xs text-gray-500 mt-3 text-center max-w-[250px]">
                    Or copy the link: <br />
                    <a
                      href={signerStatus.approvalUrl}
                      className="text-purple-600 hover:underline break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {signerStatus.approvalUrl.substring(0, 50)}...
                    </a>
                  </p>
                </div>
              )}
            </>
          )}

          {signerStatus.exists && signerStatus.approved && (
            <>
              <p className="text-green-400 text-sm mb-2 flex items-center gap-2">
                <FiCheck className="w-4 h-4" />
                Native posting enabled
              </p>

              <p className="text-gray-400 text-sm">
                You can now post directly to Farcaster from Dragverse without
                manual approval. Your posts will appear instantly on Warpcast.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <p className="text-xs text-gray-500">
          <strong>Security:</strong> Your signer private key is encrypted with
          AES-256-GCM and stored securely. Keys are only decrypted in-memory
          when posting.
        </p>
      </div>
    </div>
  );
}
