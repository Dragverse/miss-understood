"use client";

import { useState } from "react";
import { FiUserPlus, FiUserCheck, FiDollarSign } from "react-icons/fi";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Creator } from "@/types";

interface ProfileActionButtonsProps {
  creator: Creator;
  isOwnProfile: boolean;
  isDragverseUser: boolean;
  currentUserDID?: string;
}

export function ProfileActionButtons({
  creator,
  isOwnProfile,
  isDragverseUser,
  currentUserDID,
}: ProfileActionButtonsProps) {
  const { user, authenticated } = usePrivy();
  const { fundWallet } = useFundWallet();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState("5");
  const [isSendingTip, setIsSendingTip] = useState(false);

  const handleFollow = async () => {
    if (!currentUserDID) {
      // Redirect to login
      window.location.href = "/auth/login";
      return;
    }

    setIsLoading(true);
    try {
      // Use Dragverse follow API for all users
      const response = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerDID: currentUserDID,
          followingDID: creator.did,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
      } else {
        console.error("Follow failed:", await response.text());
      }
    } catch (error) {
      console.error("Follow error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTip = async () => {
    if (!authenticated || !user) {
      // Redirect to login
      window.location.href = "/auth/login";
      return;
    }

    // Get user's wallet address
    const wallet = user.wallet || user.linkedAccounts?.find((account: any) => account.type === 'wallet');
    if (!wallet || !('address' in wallet)) {
      alert("Please connect a wallet in settings first");
      return;
    }

    setShowTipModal(true);
  };

  const handleSendTip = async () => {
    if (!authenticated || !user) return;

    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsSendingTip(true);
    try {
      // Get user's wallet address
      const wallet = user.wallet || user.linkedAccounts?.find((account: any) => account.type === 'wallet');
      if (!wallet || !('address' in wallet)) {
        alert("No wallet connected");
        return;
      }

      // Open Privy's fund wallet modal
      await fundWallet({ address: wallet.address as string });

      // Note: Actual tip sending would require additional implementation
      // with web3 library to send transaction on Base network
      alert(`Tip of $${amount} prepared! Complete the transaction in your wallet.`);

      setShowTipModal(false);
      setTipAmount("5");
    } catch (error) {
      console.error("Tip error:", error);
      alert("Failed to send tip. Please try again.");
    } finally {
      setIsSendingTip(false);
    }
  };

  if (isOwnProfile) {
    return null;
  }

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={handleFollow}
          disabled={isLoading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition ${
            isFollowing
              ? "bg-[#2f2942] text-[#FCF1FC] hover:bg-[#3f3952] border border-[#EB83EA]/30"
              : "bg-[#EB83EA] text-white hover:bg-[#E748E6]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isFollowing ? (
            <>
              <FiUserCheck className="w-4 h-4" />
              Following
            </>
          ) : (
            <>
              <FiUserPlus className="w-4 h-4" />
              Follow
            </>
          )}
        </button>

        {isDragverseUser && (
          <button
            onClick={handleTip}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-lg"
            title="Send a tip"
          >
            <FiDollarSign className="w-4 h-4" />
            Tip
          </button>
        )}
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a0b2e] border border-[#EB83EA]/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Send a Tip</h3>
                <p className="text-sm text-gray-400 mt-1">to {creator.displayName}</p>
              </div>
              <FiDollarSign className="w-8 h-8 text-[#EB83EA]" />
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-3 text-gray-300">
                Tip Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-[#0f071a] border-2 border-[#2f2942] focus:border-[#EB83EA] rounded-xl text-2xl font-bold text-white outline-none transition"
                  placeholder="5"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {["5", "10", "20", "50"].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      tipAmount === amount
                        ? "bg-[#EB83EA] text-white"
                        : "bg-[#2f2942] text-gray-300 hover:bg-[#3f3952]"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-400">
                Tips are sent via Base network. You'll be prompted to complete the transaction in your wallet.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleSendTip}
                disabled={isSendingTip}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-purple-600 hover:from-[#E748E6] hover:to-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isSendingTip ? "Processing..." : `Send $${tipAmount} Tip`}
              </button>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount("5");
                }}
                disabled={isSendingTip}
                className="w-full px-6 py-3 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
