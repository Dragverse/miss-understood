"use client";

import { useState, useEffect } from "react";
import { FiHeart, FiMessageCircle, FiRepeat, FiExternalLink } from "react-icons/fi";
import toast from "react-hot-toast";

interface BlueskyPostActionsProps {
  postUri: string;
  postCid: string;
  externalUrl?: string;
  initialLikes?: number;
  initialReposts?: number;
  initialComments?: number;
  isLiked?: boolean;
  isReposted?: boolean;
  size?: "sm" | "md";
  showCounts?: boolean;
  onCommentClick?: () => void;
}

export function BlueskyPostActions({
  postUri,
  postCid,
  externalUrl,
  initialLikes = 0,
  initialReposts = 0,
  initialComments = 0,
  isLiked: initialIsLiked = false,
  isReposted: initialIsReposted = false,
  size = "md",
  showCounts = true,
  onCommentClick,
}: BlueskyPostActionsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isReposted, setIsReposted] = useState(initialIsReposted);
  const [likes, setLikes] = useState(initialLikes);
  const [reposts, setReposts] = useState(initialReposts);
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const buttonPadding = size === "sm" ? "p-1.5" : "p-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  // Check if user is connected to Bluesky
  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/bluesky/session");
        const data = await response.json();
        setIsConnected(data.connected);
      } catch (error) {
        setIsConnected(false);
      }
    }
    checkConnection();
  }, []);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      toast.error("Connect your Bluesky account in Settings to like posts");
      return;
    }

    if (isLiking) return;

    setIsLiking(true);
    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikes((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      const response = await fetch("/api/bluesky/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUri,
          postCid,
          action: wasLiked ? "unlike" : "like",
        }),
      });

      if (!response.ok) {
        // Revert on error
        setIsLiked(wasLiked);
        setLikes((prev) => (wasLiked ? prev + 1 : prev - 1));
        const data = await response.json();
        toast.error(data.error || "Failed to update like");
      }
    } catch (error) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikes((prev) => (wasLiked ? prev + 1 : prev - 1));
      toast.error("Failed to update like");
    } finally {
      setIsLiking(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      toast.error("Connect your Bluesky account in Settings to repost");
      return;
    }

    if (isReposting) return;

    setIsReposting(true);
    const wasReposted = isReposted;

    // Optimistic update
    setIsReposted(!isReposted);
    setReposts((prev) => (wasReposted ? prev - 1 : prev + 1));

    try {
      const response = await fetch("/api/bluesky/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUri,
          postCid,
          action: wasReposted ? "unrepost" : "repost",
        }),
      });

      if (!response.ok) {
        // Revert on error
        setIsReposted(wasReposted);
        setReposts((prev) => (wasReposted ? prev + 1 : prev - 1));
        const data = await response.json();
        toast.error(data.error || "Failed to update repost");
      } else {
        toast.success(wasReposted ? "Removed repost" : "Reposted to Bluesky");
      }
    } catch (error) {
      // Revert on error
      setIsReposted(wasReposted);
      setReposts((prev) => (wasReposted ? prev + 1 : prev - 1));
      toast.error("Failed to update repost");
    } finally {
      setIsReposting(false);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      toast.error("Connect your Bluesky account in Settings to comment");
      return;
    }

    if (onCommentClick) {
      onCommentClick();
    }
  };

  const handleOpenExternal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (externalUrl) {
      window.open(externalUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like button */}
      <button
        onClick={handleLike}
        disabled={isLiking}
        className={`${buttonPadding} rounded-full transition-colors flex items-center gap-1 ${
          isLiked
            ? "text-red-500 hover:text-red-400"
            : "text-gray-400 hover:text-red-400 hover:bg-red-500/10"
        } disabled:opacity-50`}
        title={isLiked ? "Unlike" : "Like"}
      >
        <FiHeart
          className={`${iconSize} ${isLiked ? "fill-current" : ""}`}
        />
        {showCounts && likes > 0 && (
          <span className={textSize}>{likes}</span>
        )}
      </button>

      {/* Comment button */}
      <button
        onClick={handleComment}
        className={`${buttonPadding} rounded-full transition-colors flex items-center gap-1 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10`}
        title="Comment"
      >
        <FiMessageCircle className={iconSize} />
        {showCounts && initialComments > 0 && (
          <span className={textSize}>{initialComments}</span>
        )}
      </button>

      {/* Repost button */}
      <button
        onClick={handleRepost}
        disabled={isReposting}
        className={`${buttonPadding} rounded-full transition-colors flex items-center gap-1 ${
          isReposted
            ? "text-green-500 hover:text-green-400"
            : "text-gray-400 hover:text-green-400 hover:bg-green-500/10"
        } disabled:opacity-50`}
        title={isReposted ? "Undo repost" : "Repost"}
      >
        <FiRepeat className={iconSize} />
        {showCounts && reposts > 0 && (
          <span className={textSize}>{reposts}</span>
        )}
      </button>

      {/* View on Bluesky button */}
      {externalUrl && (
        <button
          onClick={handleOpenExternal}
          className={`${buttonPadding} rounded-full transition-colors text-gray-400 hover:text-[#EB83EA] hover:bg-[#EB83EA]/10`}
          title="View on Bluesky"
        >
          <FiExternalLink className={iconSize} />
        </button>
      )}
    </div>
  );
}
