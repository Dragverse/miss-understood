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

    // Open Privy's funding modal to fund wallet and send tip
    try {
      // Get user's wallet address - use embedded wallet or linked wallet
      const wallet = user.wallet || user.linkedAccounts?.find((account: any) => account.type === 'wallet');
      if (wallet && wallet.address) {
        await fundWallet(wallet.address);
      }
      setShowTipModal(true);
    } catch (error) {
      console.error("Funding wallet error:", error);
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
            <h3 className="text-xl font-bold mb-4 text-white">Send a Tip to {creator.displayName}</h3>
            <p className="text-gray-400 mb-6">
              Use Privy Pay to send crypto tips directly to {creator.displayName}'s wallet.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => fundWallet()}
                className="w-full px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-semibold rounded-lg transition"
              >
                Fund Wallet & Send Tip
              </button>
              <button
                onClick={() => setShowTipModal(false)}
                className="w-full px-6 py-3 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-lg transition"
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
