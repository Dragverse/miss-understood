"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiHeart, FiMessageCircle, FiExternalLink, FiBookmark } from "react-icons/fi";

interface PostCardProps {
  post: {
    id: string;
    creator: {
      displayName: string;
      handle: string;
      avatar: string;
    };
    description: string;
    thumbnail?: string;
    createdAt: Date | string;
    likes: number;
    externalUrl?: string;
  };
}

export function PostCard({ post }: PostCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const formattedDate = new Date(post.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Check bookmark status on mount
  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
    setIsBookmarked(bookmarks.includes(post.id));
  }, [post.id]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");

    if (isBookmarked) {
      const updated = bookmarks.filter((id: string) => id !== post.id);
      localStorage.setItem("dragverse_bookmarks", JSON.stringify(updated));
      setIsBookmarked(false);
    } else {
      bookmarks.push(post.id);
      localStorage.setItem("dragverse_bookmarks", JSON.stringify(bookmarks));
      setIsBookmarked(true);
    }

    // Dispatch custom event to notify sidebar
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-xl p-6 hover:border-[#EB83EA]/30 transition">
      {/* Author */}
      <div className="flex items-start gap-3 mb-4">
        <Link href={`/profile/${post.creator.handle}`}>
          <Image
            src={post.creator.avatar}
            alt={post.creator.displayName}
            width={56}
            height={56}
            className="rounded-full hover:ring-2 hover:ring-[#EB83EA] transition"
          />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.creator.handle}`}
            className="font-semibold text-lg hover:text-[#EB83EA] transition"
          >
            {post.creator.displayName}
          </Link>
          <p className="text-sm text-gray-400">@{post.creator.handle}</p>
        </div>
        <span className="text-xs text-gray-500">{formattedDate}</span>
      </div>

      {/* Content */}
      <p className="text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed">
        {post.description}
      </p>

      {/* Images */}
      {post.thumbnail && (
        <div className="relative w-full rounded-xl overflow-hidden mb-4 bg-[#0f071a] group cursor-pointer">
          <Image
            src={post.thumbnail}
            alt="Post image"
            width={800}
            height={600}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-400 text-sm pt-3 border-t border-[#2f2942]">
        <button className="flex items-center gap-2 hover:text-red-400 transition-colors">
          <FiHeart className="w-5 h-5" />
          <span>{post.likes.toLocaleString()}</span>
        </button>
        <button className="flex items-center gap-2 hover:text-blue-400 transition-colors">
          <FiMessageCircle className="w-5 h-5" />
          <span>Comment</span>
        </button>
        <button
          onClick={toggleBookmark}
          className={`flex items-center gap-2 transition-colors ${
            isBookmarked ? "text-[#EB83EA]" : "hover:text-[#EB83EA]"
          }`}
        >
          <FiBookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
          <span>Save</span>
        </button>
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-[#EB83EA] transition-colors ml-auto"
          >
            <FiExternalLink className="w-5 h-5" />
            <span>View on Bluesky</span>
          </a>
        )}
      </div>
    </div>
  );
}
