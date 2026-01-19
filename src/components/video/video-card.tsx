"use client";

import type { Video } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiHeart, FiExternalLink } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { VideoOptionsMenu } from "./video-options-menu";
import { useAuthUser } from "@/lib/privy/hooks";

interface VideoCardProps {
  video: Video;
  layout?: "grid" | "list";
}

export function VideoCard({ video, layout = "grid" }: VideoCardProps) {
  const router = useRouter();
  const { userId } = useAuthUser();

  // Check if this is external content (from Bluesky, YouTube, etc.)
  const isExternal = (video as any).source === "bluesky" || (video as any).source === "youtube";
  const externalUrl = (video as any).externalUrl;
  const isOwner = userId && video.creator.did === userId;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = () => {
    // Always navigate to Dragverse watch page (embedded players will show external content)
    router.push(`/watch/${video.id}`);
  };

  const handleEdit = () => {
    router.push(`/upload?edit=${video.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this video? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/video/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      // Reload page to reflect deletion
      window.location.reload();
    } catch (error) {
      console.error("Error deleting video:", error);
      alert("Failed to delete video. Please try again.");
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/watch/${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, url });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (layout === "list") {
    return (
      <div
        className="flex gap-4 p-3 hover:bg-gray-900/50 rounded-lg cursor-pointer transition"
        onClick={handleClick}
      >
        <div className="relative w-48 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
          <Image
            src={video.thumbnail || '/default-thumbnail.jpg'}
            alt={video.title}
            fill
            className="object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium">
            {formatDuration(video.duration)}
          </div>
        </div>

        <div className="flex-1 py-2">
          <h3 className="font-semibold text-sm line-clamp-2 hover:text-purple-400">
            {video.title}
          </h3>
          <div className="text-xs text-gray-400 mt-1">
            <Link
              href={`/profile/${video.creator.handle}`}
              className="hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {video.creator.displayName}
            </Link>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatNumber(video.views)} views • {video.category}
          </div>
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">
            {video.description}
          </p>
        </div>
      </div>
    );
  }

  // Grid layout
  return (
    <div
      className="group cursor-pointer"
      onClick={handleClick}
    >
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 mb-3 shadow-lg">
          <Image
            src={video.thumbnail || '/default-thumbnail.jpg'}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Duration badge */}
          {video.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/90 px-2 py-0.5 rounded text-xs font-semibold backdrop-blur-sm">
              {formatDuration(video.duration)}
            </div>
          )}
          {/* Content type badge */}
          {video.contentType !== "long" && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-1 rounded-full text-xs font-bold uppercase shadow-lg">
              {video.contentType}
            </div>
          )}
          {/* Three-dot menu (only show for owner or non-external content) */}
          {!isExternal && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <VideoOptionsMenu
                video={video}
                isOwner={isOwner || false}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            </div>
          )}
          {/* External content indicator */}
          {isExternal && (
            <div className="absolute top-2 right-2 bg-blue-500/90 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm flex items-center gap-1">
              <SiBluesky className="w-3 h-3" />
              <FiExternalLink className="w-3 h-3" />
            </div>
          )}
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div className="flex gap-3">
          {/* Creator avatar */}
          <div className="flex-shrink-0">
            <Image
              src={video.creator.avatar}
              alt={video.creator.displayName}
              width={36}
              height={36}
              className="rounded-full"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-purple-400 transition leading-snug">
              {video.title}
            </h3>
            <Link
              href={`/profile/${video.creator.handle}`}
              className="text-xs text-gray-400 hover:text-white transition mt-1 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {video.creator.displayName}
              {video.creator.verified && (
                <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </Link>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <span>{formatNumber(video.views)} views</span>
              <span className="text-gray-700">•</span>
              <span className="flex items-center gap-1">
                <FiHeart className="w-3 h-3" /> {formatNumber(video.likes)}
              </span>
            </div>
          </div>
        </div>
    </div>
  );
}
