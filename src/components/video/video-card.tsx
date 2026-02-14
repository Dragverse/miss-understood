"use client";

import type { Video } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FiHeart, FiExternalLink } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { VideoOptionsMenu } from "./video-options-menu";
import { useAuthUser } from "@/lib/privy/hooks";
import { getSafeThumbnail, getSafeAvatar } from "@/lib/utils/thumbnail-helpers";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";
import toast from "react-hot-toast";

interface VideoCardProps {
  video: Video;
  layout?: "grid" | "list";
}

export function VideoCard({ video, layout = "grid" }: VideoCardProps) {
  const router = useRouter();
  const { userId } = useAuthUser();
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isLiking, setIsLiking] = useState(false);

  // Check if this is external content (from Bluesky, YouTube, etc.)
  const isExternal = (video as any).source === "bluesky" || (video as any).source === "youtube";
  const externalUrl = (video as any).externalUrl;
  const isOwner = userId && video.creator.did === userId;

  // Check like status on mount
  useEffect(() => {
    if (!userId || isExternal) return;

    const checkLikeStatus = async () => {
      try {
        const response = await fetch(
          `/api/social/like?videoId=${video.id}`,
          { credentials: 'include' }
        );
        const data = await response.json();
        setIsLiked(data.liked);
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    };

    checkLikeStatus();
  }, [video.id, userId, isExternal]);

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
    // Navigate to correct page based on content type
    const isAudio = video.contentType === 'podcast' || video.contentType === 'music';
    const targetPage = isAudio ? 'listen' : 'watch';
    router.push(`/${targetPage}/${video.id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent card click navigation

    if (!userId) {
      toast.error("Please sign in to like videos");
      return;
    }

    if (isLiking || isExternal) return;

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
          videoId: video.id,
          action: previousState ? "unlike" : "like",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error("Like failed");
      }
    } catch (error) {
      console.error("Error liking video:", error);
      // Revert optimistic update
      setIsLiked(previousState);
      setLikeCount(previousCount);
      toast.error("Failed to like video");
    } finally {
      setIsLiking(false);
    }
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

      toast.success("Video deleted successfully");

      // Reload page to reflect deletion
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video. Please try again.");
    }
  };

  const handleShare = () => {
    const isAudio = video.contentType === 'podcast' || video.contentType === 'music';
    const targetPage = isAudio ? 'listen' : 'watch';
    const url = `${window.location.origin}/${targetPage}/${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
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
            src={thumbnailError ? '/default-thumbnail.jpg' : getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', (video as any).playbackId)}
            alt={video.title}
            fill
            className="object-cover"
            loading="lazy"
            sizes="192px"
            onError={() => setThumbnailError(true)}
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
            {video.category}
          </div>
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">
            {video.description}
          </p>
        </div>
      </div>
    );
  }

  // Grid layout
  // Use dynamic aspect ratio based on content type
  const aspectRatioClass = video.contentType === "short" ? "aspect-[9/16]" : "aspect-video";
  const objectFit = video.contentType === "short" ? "object-contain" : "object-cover";

  return (
    <div
      className="group cursor-pointer"
      onClick={handleClick}
    >
        <div className={`relative w-full ${aspectRatioClass} rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 mb-3 shadow-lg`}>
          <Image
            src={thumbnailError ? '/default-thumbnail.jpg' : getSafeThumbnail(video.thumbnail, '/default-thumbnail.jpg', (video as any).playbackId)}
            alt={video.title}
            fill
            className={`${objectFit} group-hover:scale-105 transition-transform duration-300`}
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw"
            onError={() => setThumbnailError(true)}
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
          {/* Crosspost badges - show which platforms this was shared to */}
          {video.crosspostedTo && video.crosspostedTo.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-1">
              {video.crosspostedTo.includes('bluesky') && (
                <div
                  className="bg-blue-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  title="Shared to Bluesky"
                >
                  <SiBluesky className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {video.crosspostedTo.includes('farcaster') && (
                <div
                  className="bg-purple-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  title="Shared to Farcaster"
                >
                  <Image
                    src="/farcaster-transparent-white.svg"
                    alt="Farcaster"
                    width={10}
                    height={10}
                    className="w-2.5 h-2.5"
                  />
                </div>
              )}
            </div>
          )}
          {/* Three-dot menu (only show for owner or non-external content) */}
          {!isExternal && (
            <div className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
              <VideoOptionsMenu
                video={video}
                isOwner={isOwner || false}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            </div>
          )}
          {/* Source indicator badges - discreet bottom-left corner */}
          {(video as any).source === "youtube" && (
            <div className="absolute bottom-2 left-2 bg-gray-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
              <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="text-[10px] text-gray-300 font-medium">YT</span>
            </div>
          )}
          {(video as any).source === "bluesky" && (
            <div className="absolute bottom-2 left-2 bg-gray-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
              <SiBluesky className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-gray-300 font-medium">BS</span>
            </div>
          )}
          {(video as any).source === "ceramic" && (
            <div className="absolute bottom-2 left-2 bg-gray-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
              <Image src="/logo.svg" alt="" width={12} height={12} />
              <span className="text-[10px] text-purple-300 font-medium">DV</span>
            </div>
          )}
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div className="flex gap-3">
          {/* Creator avatar */}
          <div className="flex-shrink-0">
            <Image
              src={getSafeAvatar(video.creator.avatar, "/defaultpfp.png")}
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
              <span>{video.creator.displayName}</span>
              <VerificationBadge
                badgeType={getUserBadgeType(
                  video.creator.did,
                  undefined,
                  !!(video.creator as any).blueskyHandle,
                  !!(video.creator as any).farcasterHandle
                )}
                size={14}
              />
            </Link>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {!isExternal ? (
                <button
                  onClick={handleLike}
                  disabled={isLiking}
                  className="flex items-center gap-1 transition-colors hover:text-[#EB83EA] disabled:opacity-50"
                  aria-label={isLiked ? "Unlike video" : "Like video"}
                >
                  <FiHeart
                    className={`w-3 h-3 ${isLiked ? 'fill-[#EB83EA] text-[#EB83EA]' : ''}`}
                  />
                  <span>{formatNumber(likeCount)}</span>
                </button>
              ) : (
                <>
                  <FiHeart className="w-3 h-3" />
                  <span>{formatNumber(video.likes)}</span>
                </>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
