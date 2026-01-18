"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal } from "react-icons/fi";

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

const MOOD_EMOJIS: Record<string, string> = {
  sparkling: "✨",
  soft: "💖",
  fierce: "🔥",
  dramatic: "🎭",
  playful: "🌈",
  regal: "👑",
  slay: "💅",
  magical: "🦄",
};

export function PostCard({ post }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes);

  const handleLike = async () => {
    setLiked(!liked);
    setLocalLikes(liked ? localLikes - 1 : localLikes + 1);
    // TODO: Call API to toggle like
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const moodGradient = post.mood ? MOOD_GRADIENTS[post.mood] : "";
  const moodEmoji = post.mood ? MOOD_EMOJIS[post.mood] : null;

  return (
    <article
      className={`bg-gradient-to-br ${
        moodGradient || "from-[#18122D] to-[#1a0b2e]"
      } rounded-3xl p-6 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all shadow-lg hover:shadow-xl hover:shadow-[#EB83EA]/10`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/profile/${post.creator?.handle || post.creator_did}`}
          className="flex items-center gap-3 group"
        >
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#EB83EA]/30 group-hover:border-[#EB83EA] transition-all">
            {post.creator?.avatar ? (
              <Image
                src={post.creator.avatar}
                alt={post.creator.display_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
                <span className="text-white text-xl">
                  {post.creator?.display_name?.[0] || "?"}
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-bold group-hover:text-[#EB83EA] transition-colors">
              {post.creator?.display_name || "Unknown"}
            </p>
            <p className="text-gray-400 text-sm">
              @{post.creator?.handle || post.creator_did.slice(0, 8)} •{" "}
              {formatTimeAgo(post.created_at)}
            </p>
          </div>
        </Link>

        <button className="p-2 hover:bg-[#2f2942] rounded-full transition-colors">
          <FiMoreHorizontal className="text-gray-400" />
        </button>
      </div>

      {/* Mood indicator */}
      {moodEmoji && (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#EB83EA]/10 rounded-full border border-[#EB83EA]/20 mb-3">
          <span className="text-lg">{moodEmoji}</span>
          <span className="text-[#EB83EA] text-xs font-semibold capitalize">
            {post.mood}
          </span>
        </div>
      )}

      {/* Text content */}
      {post.text_content && (
        <p className="text-white text-lg leading-relaxed mb-4 whitespace-pre-wrap">
          {post.text_content}
        </p>
      )}

      {/* Media grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`grid gap-2 mb-4 rounded-2xl overflow-hidden ${
            post.media_urls.length === 1
              ? "grid-cols-1"
              : post.media_urls.length === 2
              ? "grid-cols-2"
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
              {/* Sparkle overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#EB83EA]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}

      {/* Engagement bar */}
      <div className="flex items-center justify-between pt-4 border-t border-[#EB83EA]/10">
        <div className="flex items-center gap-6">
          {/* Like button */}
          <button
            onClick={handleLike}
            className="flex items-center gap-2 group"
          >
            <div
              className={`p-2 rounded-full transition-all ${
                liked
                  ? "bg-[#EB83EA] text-white"
                  : "hover:bg-[#EB83EA]/20 text-gray-400 group-hover:text-[#EB83EA]"
              }`}
            >
              <FiHeart className={liked ? "fill-current" : ""} size={20} />
            </div>
            <span
              className={`font-semibold ${
                liked ? "text-[#EB83EA]" : "text-gray-400 group-hover:text-white"
              }`}
            >
              {localLikes}
            </span>
          </button>

          {/* Comment button */}
          <button className="flex items-center gap-2 group">
            <div className="p-2 rounded-full hover:bg-[#EB83EA]/20 text-gray-400 group-hover:text-[#EB83EA] transition-all">
              <FiMessageCircle size={20} />
            </div>
            <span className="text-gray-400 group-hover:text-white font-semibold">
              {post.comment_count}
            </span>
          </button>

          {/* Share button */}
          <button className="flex items-center gap-2 group">
            <div className="p-2 rounded-full hover:bg-[#EB83EA]/20 text-gray-400 group-hover:text-[#EB83EA] transition-all">
              <FiShare2 size={20} />
            </div>
            {post.repost_count > 0 && (
              <span className="text-gray-400 group-hover:text-white font-semibold">
                {post.repost_count}
              </span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
