"use client";

import { useState } from "react";
import { FiUserPlus, FiUserCheck, FiDollarSign } from "react-icons/fi";
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    if (!currentUserDID) {
      // Redirect to login
      window.location.href = "/auth/login";
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/bluesky/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          did: creator.blueskyDID || creator.did,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
      }
    } catch (error) {
      console.error("Follow error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTip = () => {
    // TODO: Open tip modal
    alert("Tip functionality coming soon!");
  };

  if (isOwnProfile) {
    return null;
  }

  return (
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
          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition bg-[#2f2942] text-[#FCF1FC] hover:bg-[#3f3952] border border-[#EB83EA]/30"
        >
          <FiDollarSign className="w-4 h-4" />
          Tip
        </button>
      )}
    </div>
  );
}
