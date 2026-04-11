"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";
import { CreatorInfo } from "@/components/shared/creator-info";
import { EngagementBar } from "@/components/shared/engagement-bar";
import { useAuthUser } from "@/lib/privy/hooks";
import { parseTextWithLinks } from "@/lib/text-parser";

interface PostCardProps {
  post: {
    id: string;
    creator_did: string;
    text_content?: string;
    media_urls?: string[];
    media_types?: string[];
    mood?: string;
    likes: number;
    comment_count: number;
    repost_count: number;
    created_at: string;
    creator?: {
      did: string;
      handle: string;
      display_name: string;
      avatar?: string;
      verified?: boolean;
    };
  };
  onDelete?: (postId: string) => void;
}

const MOOD_COLORS: Record<string, string> = {
  sparkling: "text-yellow-400",
  soft: "text-pink-300",
  fierce: "text-orange-400",
  dramatic: "text-purple-400",
  playful: "text-blue-400",
  regal: "text-amber-400",
  slay: "text-fuchsia-400",
  magical: "text-indigo-400",
};

export function PostCard({ post, onDelete }: PostCardProps) {
  const { getAccessToken } = usePrivy();
  const { userId } = useAuthUser();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = userId === post.creator_did;

  // Check like status on mount
  useEffect(() => {
    if (!userId) return;

    const checkLikeStatus = async () => {
      try {
        const response = await fetch(
          `/api/social/like?videoId=${post.id}`,
          { credentials: "include" }
        );
        const data = await response.json();
        setIsLiked(data.liked);
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    };

    checkLikeStatus();
  }, [post.id, userId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLike = async () => {
    if (!userId) {
      toast.error("Please sign in to like posts");
      return;
    }
    if (isLiking) return;

    // Optimistic update
    const previousState = isLiked;
    const previousCount = likeCount;
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    setIsLiking(true);

    try {
      const response = await fetch("/api/social/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoId: post.id,
          action: previousState ? "unlike" : "like",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error("Like failed");
      }
    } catch (error) {
      console.error("Error liking post:", error);
      setIsLiked(previousState);
      setLikeCount(previousCount);
      toast.error("Failed to like post");
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;

    const confirmed = window.confirm("Are you sure you want to delete this post?");
    if (!confirmed) return;

    setIsDeleting(true);
    setShowMenu(false);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/posts/delete?postId=${post.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("Post deleted");
        onDelete?.(post.id);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete post");
      }
    } catch (error) {
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const moodColor = post.mood ? MOOD_COLORS[post.mood] : "";

  return (
    <article className="bg-[#1a0b2e] rounded-xl p-5 border border-[#2f2942] hover:border-[#EB83EA]/30 transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreatorInfo
            avatar={post.creator?.avatar}
            displayName={post.creator?.display_name || "Unknown"}
            handle={post.creator?.handle || post.creator_did.slice(0, 8)}
            did={post.creator?.did || post.creator_did}
            verified={post.creator?.verified}
            date={post.created_at}
          />
          {post.mood && (
            <span className={`text-xs font-medium capitalize ${moodColor}`}>
              · {post.mood}
            </span>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Post options"
          >
            <FiMoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a0b2e] border border-[#2f2942] rounded-xl shadow-xl z-10 overflow-hidden">
              {isOwner && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <FiTrash2 className="w-4 h-4" />
                  {isDeleting ? "Deleting..." : "Delete Post"}
                </button>
              )}
              {!isOwner && (
                <p className="px-4 py-3 text-gray-500 text-sm">No actions available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text content */}
      {post.text_content && (
        <div className="mb-4 text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap">
          {parseTextWithLinks(post.text_content)}
        </div>
      )}

      {/* Media grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`grid gap-1 mb-4 rounded-xl overflow-hidden ${
            post.media_urls.length === 1
              ? "grid-cols-1"
              : "grid-cols-2"
          }`}
        >
          {post.media_urls.map((url, index) => (
            <div
              key={index}
              className={`relative ${
                post.media_urls!.length === 3 && index === 0
                  ? "col-span-2 aspect-video"
                  : "aspect-square"
              } overflow-hidden group cursor-pointer`}
            >
              <Image
                src={url}
                alt={`Post image ${index + 1}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}

      {/* Engagement bar */}
      <EngagementBar
        contentId={post.id}
        contentType="post"
        likes={likeCount}
        comments={post.comment_count}
        isLiked={isLiked}
        onLike={handleLike}
        shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/posts/${post.id}`}
      />
    </article>
  );
}
