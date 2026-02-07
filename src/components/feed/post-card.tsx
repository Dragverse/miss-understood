"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiHeart, FiMessageCircle, FiExternalLink, FiBookmark, FiUserPlus, FiUserCheck } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { parseTextWithLinks } from "@/lib/text-parser";
import { CommentModal } from "./comment-modal";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { getSafeThumbnail, isValidPlaybackUrl } from "@/lib/utils/thumbnail-helpers";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { getUserBadgeType } from "@/lib/verification";
import { TipButton } from "@/components/shared";
import { usePrivy } from "@privy-io/react-auth";

interface PostCardProps {
  post: {
    id: string;
    creator: {
      displayName: string;
      handle: string;
      avatar: string;
      did?: string; // Bluesky DID for following
      blueskyHandle?: string; // For badge verification
      farcasterHandle?: string; // For badge verification
      walletAddress?: string; // For tipping
    };
    description: string;
    thumbnail?: string;
    createdAt: Date | string;
    likes: number;
    externalUrl?: string;
    uri?: string; // Bluesky post URI
    cid?: string; // Bluesky post CID
    playbackUrl?: string; // Video playback URL
    contentType?: string; // "short" or "long"
    type?: string; // "youtube-video" for YouTube posts
  };
}

export function PostCard({ post }: PostCardProps) {
  const { user } = usePrivy();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [isLiking, setIsLiking] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const isOwnPost = user?.id && post.creator.did && post.creator.did === user.id;

  const formattedDate = new Date(post.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Check bookmark, like, and follow status on mount
  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
    setIsBookmarked(bookmarks.includes(post.id));

    // Check if user has liked this post (stored locally)
    const likes = JSON.parse(localStorage.getItem("dragverse_likes") || "[]");
    setIsLiked(likes.includes(post.id));

    // Check if user is following this creator (stored locally)
    if (post.creator.did) {
      const following = JSON.parse(localStorage.getItem("dragverse_following") || "[]");
      setIsFollowing(following.includes(post.creator.did));
    }
  }, [post.id, post.creator.did]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();

    // If no Bluesky URI/CID, just update local state
    if (!post.uri || !post.cid) {
      const likes = JSON.parse(localStorage.getItem("dragverse_likes") || "[]");
      if (isLiked) {
        const updated = likes.filter((id: string) => id !== post.id);
        localStorage.setItem("dragverse_likes", JSON.stringify(updated));
        setIsLiked(false);
        setLikeCount(likeCount - 1);
      } else {
        likes.push(post.id);
        localStorage.setItem("dragverse_likes", JSON.stringify(likes));
        setIsLiked(true);
        setLikeCount(likeCount + 1);
      }
      return;
    }

    // Try to like/unlike on Bluesky
    setIsLiking(true);
    try {
      const response = await fetch("/api/bluesky/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUri: post.uri,
          postCid: post.cid,
          action: isLiked ? "unlike" : "like",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        const likes = JSON.parse(localStorage.getItem("dragverse_likes") || "[]");
        if (isLiked) {
          const updated = likes.filter((id: string) => id !== post.id);
          localStorage.setItem("dragverse_likes", JSON.stringify(updated));
          setIsLiked(false);
          setLikeCount(likeCount - 1);
        } else {
          likes.push(post.id);
          localStorage.setItem("dragverse_likes", JSON.stringify(likes));
          setIsLiked(true);
          setLikeCount(likeCount + 1);
        }
      } else {
        console.error("Failed to like/unlike post:", data.error);
      }
    } catch (error) {
      console.error("Error liking/unliking post:", error);
    } finally {
      setIsLiking(false);
    }
  };

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

  const toggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!post.creator.did) return;

    setIsFollowLoading(true);
    try {
      const response = await fetch("/api/bluesky/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          did: post.creator.did,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        const following = JSON.parse(localStorage.getItem("dragverse_following") || "[]");
        if (isFollowing) {
          const updated = following.filter((did: string) => did !== post.creator.did);
          localStorage.setItem("dragverse_following", JSON.stringify(updated));
          setIsFollowing(false);
        } else {
          following.push(post.creator.did);
          localStorage.setItem("dragverse_following", JSON.stringify(following));
          setIsFollowing(true);
        }
      } else {
        console.error("Failed to follow/unfollow:", data.error);
      }
    } catch (error) {
      console.error("Error following/unfollowing:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <>
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
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${post.creator.handle}`}
              className="font-semibold text-lg hover:text-[#EB83EA] transition"
            >
              {post.creator.displayName}
            </Link>
            <VerificationBadge
              badgeType={getUserBadgeType(
                post.creator.did,
                undefined,
                !!post.creator.blueskyHandle,
                !!post.creator.farcasterHandle
              )}
              size={18}
            />
          </div>
          <p className="text-sm text-gray-400">@{post.creator.handle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{formattedDate}</span>
          {post.creator.did && (
            <button
              onClick={toggleFollow}
              disabled={isFollowLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                isFollowing
                  ? "bg-white/10 text-gray-300 hover:bg-white/20"
                  : "bg-[#EB83EA] text-white hover:bg-[#E748E6]"
              } ${isFollowLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isFollowing ? (
                <>
                  <FiUserCheck className="w-4 h-4" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <FiUserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic source badge */}
      {(post as any).source === "youtube" ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30 mb-3">
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span className="text-red-300 text-[10px] font-semibold uppercase">YouTube</span>
        </div>
      ) : (post as any).source === "ceramic" || (post as any).source === "dragverse" ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded-full border border-purple-500/30 mb-3">
          <Image src="/logo.svg" alt="" width={12} height={12} />
          <span className="text-purple-300 text-[10px] font-semibold uppercase">Dragverse</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded-full border border-blue-500/30 mb-3">
          <SiBluesky className="w-3 h-3 text-blue-400" />
          <span className="text-blue-300 text-[10px] font-semibold uppercase">Bluesky</span>
        </div>
      )}

      {/* Content */}
      <div className="text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed">
        {parseTextWithLinks(post.description)}
      </div>

      {/* Video Player or Thumbnail */}
      {post.playbackUrl && isValidPlaybackUrl(post.playbackUrl) ? (
        <div className="relative w-full rounded-xl overflow-hidden mb-4 bg-[#0f071a]">
          {post.type === "youtube-video" || post.playbackUrl.includes("youtube.com") || post.playbackUrl.includes("youtu.be") ? (
            // YouTube video - use iframe embed
            <div className="relative w-full" style={{ aspectRatio: post.contentType === "short" ? "9/16" : "16/9" }}>
              <iframe
                src={post.playbackUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="absolute inset-0 w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            // Livepeer video (Dragverse/Bluesky)
            <div className="relative w-full" style={{ aspectRatio: post.contentType === "short" ? "9/16" : "16/9" }}>
              <Player.Root src={getSrc(post.playbackUrl)}>
                <Player.Container>
                  <Player.Video
                    title={post.description.substring(0, 100)}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                  <Player.Controls className="flex items-center justify-center">
                    <Player.PlayPauseTrigger className="w-16 h-16 flex items-center justify-center rounded-full bg-[#EB83EA]/90 hover:bg-[#E748E6] transition-all">
                      <Player.PlayingIndicator asChild matcher={false}>
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </Player.PlayingIndicator>
                      <Player.PlayingIndicator asChild matcher={true}>
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      </Player.PlayingIndicator>
                    </Player.PlayPauseTrigger>
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            </div>
          )}
        </div>
      ) : post.thumbnail ? (
        // Fallback to thumbnail image if no valid playback URL
        <div className="relative w-full rounded-xl overflow-hidden mb-4 bg-[#0f071a] group cursor-pointer">
          <Image
            src={getSafeThumbnail(post.thumbnail, '/default-thumbnail.jpg', (post as any).playbackId)}
            alt="Post image"
            width={800}
            height={600}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-400 text-sm pt-3 border-t border-[#2f2942]">
        <button
          onClick={toggleLike}
          disabled={isLiking}
          className={`flex items-center gap-2 transition-colors ${
            isLiked ? "text-red-400" : "hover:text-red-400"
          } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <FiHeart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
          <span>{likeCount.toLocaleString()}</span>
        </button>
        <button
          onClick={() => setIsCommentModalOpen(true)}
          className="flex items-center gap-2 hover:text-blue-400 transition-colors"
        >
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
        {/* Tip Button - Only for Dragverse creators with wallets */}
        {!isOwnPost && post.creator.walletAddress && post.creator.did && (
          <TipButton
            creator={{
              displayName: post.creator.displayName,
              handle: post.creator.handle,
              avatar: post.creator.avatar,
              did: post.creator.did,
              walletAddress: post.creator.walletAddress,
            } as any}
            variant="secondary"
            size="sm"
          />
        )}
        {(post as any).source === "youtube" && post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-[#EB83EA] transition-colors ml-auto"
          >
            <FiExternalLink className="w-5 h-5" />
            <span>Watch on YouTube</span>
          </a>
        )}
        {((post as any).source === "dragverse" || (post as any).source === "ceramic") && post.id && (
          <Link
            href={`/watch/${post.id}`}
            className="flex items-center gap-2 hover:text-[#EB83EA] transition-colors ml-auto"
          >
            <FiExternalLink className="w-5 h-5" />
            <span>Watch on Dragverse</span>
          </Link>
        )}
        {(post as any).source !== "youtube" && (post as any).source !== "dragverse" && (post as any).source !== "ceramic" && post.externalUrl && (
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

    {/* Comment Modal */}
    {post.uri && post.cid && (
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        postUri={post.uri}
        postCid={post.cid}
        postAuthor={{
          displayName: post.creator.displayName,
          handle: post.creator.handle,
        }}
      />
    )}
    </>
  );
}
