"use client";

import Image from "next/image";
import Link from "next/link";
import { FiHeart, FiMessageCircle, FiExternalLink } from "react-icons/fi";

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
  const formattedDate = new Date(post.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-[#1a0b2e] border border-[#2f2942] rounded-xl p-6 hover:border-[#EB83EA]/30 transition">
      {/* Author */}
      <div className="flex items-start gap-3 mb-4">
        <Link href={`/profile/${post.creator.handle}`}>
          <Image
            src={post.creator.avatar}
            alt={post.creator.displayName}
            width={48}
            height={48}
            className="rounded-full hover:ring-2 hover:ring-[#EB83EA] transition"
          />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.creator.handle}`}
            className="font-semibold hover:text-[#EB83EA] transition"
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
        <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4 bg-[#0f071a]">
          <Image
            src={post.thumbnail}
            alt="Post image"
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-400 text-sm pt-3 border-t border-[#2f2942]">
        <button className="flex items-center gap-2 hover:text-red-400 transition-colors">
          <FiHeart className="w-5 h-5" />
          <span>{post.likes}</span>
        </button>
        <button className="flex items-center gap-2 hover:text-blue-400 transition-colors">
          <FiMessageCircle className="w-5 h-5" />
          <span>Comment</span>
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
