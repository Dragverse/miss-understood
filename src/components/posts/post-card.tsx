"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FiMoreHorizontal, FiActivity, FiFilm, FiSmile, FiAward, FiStar, FiHeart, FiTrash2 } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";
import { CreatorInfo } from "@/components/shared/creator-info";
import { EngagementBar } from "@/components/shared/engagement-bar";
import { useAuthUser } from "@/lib/privy/hooks";

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

const MOOD_GRADIENTS: Record<string, string> = {
  sparkling: "from-purple-500/10 via-pink-500/10 to-yellow-500/10",
  soft: "from-pink-300/10 via-rose-300/10 to-purple-300/10",
  fierce: "from-red-500/10 via-orange-500/10 to-yellow-500/10",
  dramatic: "from-purple-900/10 via-black/10 to-purple-900/10",
  playful: "from-blue-400/10 via-pink-400/10 to-yellow-400/10",
  regal: "from-purple-700/10 via-gold/10 to-purple-700/10",
  slay: "from-fuchsia-500/10 via-pink-500/10 to-rose-500/10",
  magical: "from-indigo-500/10 via-purple-500/10 to-pink-500/10",
};

const MOOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkling: FiStar,
  soft: FiHeart,
  fierce: FiActivity,
  dramatic: FiFilm,
  playful: FiSmile,
  regal: FiAward,
  slay: FiStar,
  magical: FiSmile,
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

  const moodGradient = post.mood ? MOOD_GRADIENTS[post.mood] : "";
  const MoodIcon = post.mood ? MOOD_ICONS[post.mood] : null;

  return (
    <article
      className={`bg-gradient-to-br ${
        moodGradient || "from-[#18122D] to-[#1a0b2e]"
      } rounded-3xl p-6 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all shadow-lg hover:shadow-xl hover:shadow-[#EB83EA]/10`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <CreatorInfo
          avatar={post.creator?.avatar}
          displayName={post.creator?.display_name || "Unknown"}
          handle={post.creator?.handle || post.creator_did.slice(0, 8)}
          did={post.creator?.did || post.creator_did}
          verified={post.creator?.verified}
          date={post.created_at}
        />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-[#2f2942] rounded-full transition-colors"
          >
            <FiMoreHorizontal className="text-gray-400" />
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

      {/* Source badge and mood indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
          <Image src="/logo.svg" alt="" width={12} height={12} />
          <span className="text-purple-300 text-[10px] font-semibold uppercase">Dragverse</span>
        </div>

        {MoodIcon && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#EB83EA]/10 rounded-full border border-[#EB83EA]/20">
            <MoodIcon className="text-[#EB83EA] w-4 h-4" />
            <span className="text-[#EB83EA] text-xs font-semibold capitalize">
              {post.mood}
            </span>
          </div>
        )}
      </div>

      {/* Text content */}
      {post.text_content && (
        <div className={`mb-4 ${!post.media_urls || post.media_urls.length === 0 ? 'text-center py-6' : ''}`}>
          <p className={`text-white leading-relaxed whitespace-pre-wrap ${
            !post.media_urls || post.media_urls.length === 0
              ? 'text-2xl font-medium'
              : 'text-lg'
          }`}>
            {post.text_content}
          </p>
        </div>
      )}

      {/* Media grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`grid gap-2 mb-4 rounded-2xl overflow-hidden ${
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
              <div className="absolute inset-0 bg-gradient-to-t from-[#EB83EA]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
