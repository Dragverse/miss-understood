"use client";

import { useState } from "react";
import { FiHeart, FiMessageCircle, FiShare2 } from "react-icons/fi";
import toast from "react-hot-toast";

interface EngagementBarProps {
  contentId: string;
  contentType: "video" | "post" | "audio";
  likes: number;
  comments?: number;
  isLiked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  shareUrl?: string;
  compact?: boolean;
  className?: string;
}

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function EngagementBar({
  contentId,
  contentType,
  likes,
  comments,
  isLiked = false,
  onLike,
  onComment,
  shareUrl,
  compact = false,
  className = "",
}: EngagementBarProps) {
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url =
      shareUrl ||
      `${window.location.origin}/${contentType === "audio" ? "listen" : "watch"}/${contentId}`;

    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onLike?.();
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onComment?.();
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <button
          onClick={handleLikeClick}
          className="flex items-center gap-1 group"
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <FiHeart
            className={`w-4 h-4 transition-colors ${
              isLiked
                ? "text-[#EB83EA] fill-current"
                : "text-gray-400 group-hover:text-[#EB83EA]"
            }`}
          />
          {likes > 0 && (
            <span
              className={`text-xs font-semibold ${
                isLiked ? "text-[#EB83EA]" : "text-gray-400"
              }`}
            >
              {formatCount(likes)}
            </span>
          )}
        </button>

        {onComment && (
          <button
            onClick={handleCommentClick}
            className="flex items-center gap-1 group"
            aria-label="Comment"
          >
            <FiMessageCircle className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            {comments != null && comments > 0 && (
              <span className="text-xs font-semibold text-gray-400">
                {formatCount(comments)}
              </span>
            )}
          </button>
        )}

        <button
          onClick={handleShare}
          className="group"
          aria-label="Share"
        >
          <FiShare2 className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-6 pt-4 border-t border-[#EB83EA]/10 ${className}`}
    >
      <button
        onClick={handleLikeClick}
        className="flex items-center gap-2 group"
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        <div
          className={`p-2 rounded-full transition-all ${
            isLiked
              ? "bg-[#EB83EA] text-white"
              : "hover:bg-[#EB83EA]/20 text-gray-400 group-hover:text-[#EB83EA]"
          }`}
        >
          <FiHeart className={isLiked ? "fill-current" : ""} size={20} />
        </div>
        <span
          className={`font-semibold ${
            isLiked ? "text-[#EB83EA]" : "text-gray-400 group-hover:text-white"
          }`}
        >
          {formatCount(likes)}
        </span>
      </button>

      {onComment ? (
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-2 group"
          aria-label="Comment"
        >
          <div className="p-2 rounded-full hover:bg-white/10 text-gray-400 group-hover:text-white transition-all">
            <FiMessageCircle size={20} />
          </div>
          {comments != null && comments > 0 && (
            <span className="text-gray-400 group-hover:text-white font-semibold">
              {formatCount(comments)}
            </span>
          )}
        </button>
      ) : (
        <button
          className="flex items-center gap-2 opacity-40 cursor-not-allowed"
          title="Comments coming soon"
          disabled
        >
          <div className="p-2 rounded-full text-gray-500">
            <FiMessageCircle size={20} />
          </div>
          <span className="text-gray-500 font-semibold text-sm">Soon</span>
        </button>
      )}

      <button
        onClick={handleShare}
        className="flex items-center gap-2 group"
        aria-label="Share"
      >
        <div className="p-2 rounded-full hover:bg-white/10 text-gray-400 group-hover:text-white transition-all">
          <FiShare2 size={20} />
        </div>
      </button>
    </div>
  );
}
