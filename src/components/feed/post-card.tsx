"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiExternalLink, FiBookmark, FiUserPlus, FiUserCheck, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { parseTextWithLinks } from "@/lib/text-parser";
import { CommentModal } from "./comment-modal";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { getSafeThumbnail, isValidPlaybackUrl } from "@/lib/utils/thumbnail-helpers";
import { CreatorInfo } from "@/components/shared/creator-info";
import { EngagementBar } from "@/components/shared/engagement-bar";
import { TipButton } from "@/components/shared";
import { usePrivy } from "@privy-io/react-auth";
import { getVideo } from "@/lib/supabase/videos";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import toast from "react-hot-toast";

interface PostCardProps {
  post: {
    id: string;
    creator: {
      displayName: string;
      handle: string;
      avatar: string;
      did?: string;
      blueskyHandle?: string;
      walletAddress?: string;
    };
    description: string;
    thumbnail?: string;
    createdAt: Date | string;
    likes: number;
    comment_count?: number;
    externalUrl?: string;
    uri?: string;
    cid?: string;
    playbackUrl?: string;
    contentType?: string;
    type?: string;
  };
}

export function PostCard({ post }: PostCardProps) {
  const { user, getAccessToken } = usePrivy();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [audioData, setAudioData] = useState<any>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [dragverseCard, setDragverseCard] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnPost = user?.id && post.creator.did && post.creator.did === user.id;

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

  // Check bookmark, like, and follow status on mount
  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem("dragverse_bookmarks") || "[]");
    setIsBookmarked(bookmarks.includes(post.id));

    const likes = JSON.parse(localStorage.getItem("dragverse_likes") || "[]");
    setIsLiked(likes.includes(post.id));

    if (post.creator.did) {
      const following = JSON.parse(localStorage.getItem("dragverse_following") || "[]");
      setIsFollowing(following.includes(post.creator.did));
    }
  }, [post.id, post.creator.did]);

  // Detect and fetch audio from /listen/ links in description
  useEffect(() => {
    const detectAndFetchAudio = async () => {
      const textToCheck = post.description || (post as any).text_content || "";
      const listenLinkMatch = textToCheck.match(/\/listen\/([a-zA-Z0-9-]+)/);
      if (!listenLinkMatch) return;

      const audioId = listenLinkMatch[1];
      setIsLoadingAudio(true);
      setAudioError(false);

      try {
        const audioDoc = await getVideo(audioId);
        if (!audioDoc) {
          setAudioError(true);
          return;
        }

        const transformedAudio = await transformVideoWithCreator(audioDoc);
        if (transformedAudio && transformedAudio.playbackUrl) {
          setAudioData(transformedAudio);
        } else {
          setAudioError(true);
        }
      } catch (error) {
        console.error("[PostCard] Failed to fetch audio:", error);
        setAudioError(true);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    detectAndFetchAudio();
  }, [post.description, (post as any).text_content]);

  // Detect and fetch Dragverse video/snapshot links in post text
  useEffect(() => {
    const textToCheck = post.description || (post as any).text_content || "";

    // Skip if post already embeds a video itself
    if (post.playbackUrl && isValidPlaybackUrl(post.playbackUrl)) return;

    // Match /watch/[id] or /snapshots?v=[id] (relative or within a full URL)
    const watchMatch = textToCheck.match(/\/watch\/([a-zA-Z0-9-]+)/);
    const snapshotMatch = textToCheck.match(/\/snapshots[^"'\s]*[?&]v=([a-zA-Z0-9-]+)/);
    const videoId = watchMatch?.[1] || snapshotMatch?.[1];

    if (!videoId || videoId === post.id) return;

    (async () => {
      try {
        const videoDoc = await getVideo(videoId);
        if (!videoDoc) return;
        const transformed = await transformVideoWithCreator(videoDoc);
        if (transformed) setDragverseCard(transformed);
      } catch {}
    })();
  }, [post.description, (post as any).text_content, post.id, post.playbackUrl]);

  const toggleLike = async () => {
    const previousLikeState = isLiked;
    const previousLikeCount = likeCount;
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    setIsLiking(true);

    try {
      const authToken = await getAccessToken();

      // If has Bluesky URI/CID, sync to Bluesky
      if (post.uri && post.cid) {
        const response = await fetch("/api/bluesky/like", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            postUri: post.uri,
            postCid: post.cid,
            action: previousLikeState ? "unlike" : "like",
          }),
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error);
        }
      }

      // Always persist Dragverse posts to database
      if (post.id && !post.type?.includes('youtube')) {
        const response = await fetch("/api/posts/like", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            postId: post.id,
            action: previousLikeState ? "unlike" : "like",
          }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error("Failed to persist like to database:", data.error);
        }
      }

      // Update localStorage as backup
      const likes = JSON.parse(localStorage.getItem("dragverse_likes") || "[]");
      if (previousLikeState) {
        const updated = likes.filter((id: string) => id !== post.id);
        localStorage.setItem("dragverse_likes", JSON.stringify(updated));
      } else {
        if (!likes.includes(post.id)) {
          likes.push(post.id);
          localStorage.setItem("dragverse_likes", JSON.stringify(likes));
        }
      }
    } catch (error) {
      console.error("Error liking/unliking post:", error);
      setIsLiked(previousLikeState);
      setLikeCount(previousLikeCount);
      toast.error("Failed to update like. Please try again.");
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

    window.dispatchEvent(new Event("storage"));
  };

  const handleDelete = async () => {
    if (!isOwnPost) return;

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
        toast.success("Post deleted successfully");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete post");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!post.creator.did) return;

    setIsFollowLoading(true);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/bluesky/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          did: post.creator.did,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      const data = await response.json();

      if (data.success) {
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
        <div className="flex-1">
          <CreatorInfo
            avatar={post.creator.avatar}
            displayName={post.creator.displayName}
            handle={post.creator.handle}
            did={post.creator.did}
            verified={!!post.creator.blueskyHandle}
            date={post.createdAt}
          />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isOwnPost ? (
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
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    {isDeleting ? "Deleting..." : "Delete Post"}
                  </button>
                </div>
              )}
            </div>
          ) : post.creator.did && (post as any).source !== "youtube" ? (
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
          ) : null}
        </div>
      </div>

      {/* Dynamic source badge */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {(post as any).source === "youtube" ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30">
            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span className="text-red-300 text-[10px] font-semibold uppercase">YouTube</span>
          </div>
        ) : (post as any).source === "ceramic" || (post as any).source === "dragverse" ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
            <Image src="/logo.svg" alt="" width={12} height={12} />
            <span className="text-purple-300 text-[10px] font-semibold uppercase">Dragverse</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
            <SiBluesky className="w-3 h-3 text-blue-400" />
            <span className="text-blue-300 text-[10px] font-semibold uppercase">Bluesky</span>
          </div>
        )}
        {((post as any).source === "dragverse" || (post as any).source === "ceramic") && (post as any).crossposted_to?.includes("bluesky") && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
            <SiBluesky className="w-3 h-3 text-blue-400" />
            <span className="text-blue-300 text-[10px] font-semibold uppercase">Bluesky</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed">
        {parseTextWithLinks(
          dragverseCard
            ? (post.description || (post as any).text_content || "").replace(
                /https?:\/\/\S*(?:watch|snapshots)\S*/g,
                "dragverse.app/…"
              )
            : (post.description || (post as any).text_content || "")
        )}
      </div>

      {/* Video Player or Thumbnail */}
      {post.playbackUrl && isValidPlaybackUrl(post.playbackUrl) ? (
        <div className="relative w-full rounded-xl overflow-hidden mb-4 bg-[#0f071a]">
          {post.type === "youtube-video" || post.playbackUrl.includes("youtube.com") || post.playbackUrl.includes("youtu.be") ? (
            <div className="relative w-full" style={{ aspectRatio: post.contentType === "short" ? "9/16" : "16/9" }}>
              <iframe
                src={post.playbackUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="absolute inset-0 w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
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

      {/* Inline Audio Player for /listen/ links */}
      {audioData && audioData.playbackUrl && (
        <div className="mb-4 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-xl p-4 border border-[#EB83EA]/20">
          <div className="flex gap-4">
            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
              <Image
                src={audioData.thumbnail || "/default-thumbnail.jpg"}
                alt={audioData.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1">
                {audioData.title}
              </h3>
              <p className="text-xs text-gray-400 mb-3 line-clamp-1">
                {audioData.creator?.displayName || "Unknown Artist"}
              </p>
              <audio
                controls
                className="w-full"
                style={{ height: "32px", accentColor: "#EB83EA" }}
              >
                <source src={audioData.playbackUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
          <Link
            href={`/listen/${audioData.id}`}
            className="mt-3 flex items-center justify-center gap-2 text-sm text-[#EB83EA] hover:text-[#E748E6] transition-colors"
          >
            <span>Open in full player</span>
            <FiExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Audio Loading State */}
      {isLoadingAudio && (
        <div className="mb-4 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-xl p-4 border border-[#EB83EA]/20">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-[#EB83EA] border-t-transparent rounded-full animate-spin"></div>
            <span>Loading audio...</span>
          </div>
        </div>
      )}

      {/* Dragverse Link Preview Card */}
      {dragverseCard && (() => {
        const cardThumbnail = getSafeThumbnail(dragverseCard.thumbnail, "/default-thumbnail.jpg", dragverseCard.livepeerAssetId);
        const cardCreator = dragverseCard.creator?.displayName || dragverseCard.creator?.handle || "Unknown";
        const contentLabel = dragverseCard.contentType === "short" ? "Snapshot"
          : dragverseCard.contentType === "podcast" ? "Podcast"
          : dragverseCard.contentType === "music" ? "Music" : "Video";
        const PlayIcon = () => (
          <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        );
        const PauseIcon = () => (
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        );

        if (dragverseCard.contentType === "short") {
          return (
            <Link
              href={`/snapshots?v=${dragverseCard.id}`}
              className="mb-4 block rounded-xl overflow-hidden border border-[#EB83EA]/20 hover:border-[#EB83EA]/50 transition-all bg-[#0f071a] group"
            >
              <div className="relative w-full" style={{ aspectRatio: "2/3" }}>
                <Image src={cardThumbnail} alt={dragverseCard.title} fill className="object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/default-thumbnail.jpg"; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-[#EB83EA]/80 transition-all">
                    <PlayIcon />
                  </div>
                </div>
                {/* Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                  <Image src="/logo.svg" alt="" width={10} height={10} />
                  <span className="text-white text-[9px] font-bold uppercase tracking-wide">Snapshot</span>
                </div>
                {/* Title overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white font-semibold text-sm line-clamp-2 leading-tight">{dragverseCard.title}</p>
                  <p className="text-gray-300 text-xs mt-0.5">{cardCreator}</p>
                </div>
              </div>
            </Link>
          );
        }

        if (dragverseCard.playbackUrl && isValidPlaybackUrl(dragverseCard.playbackUrl)) {
          return (
            <div className="mb-4 rounded-xl overflow-hidden border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 transition-all bg-[#0f071a]">
              {/* Inline player */}
              <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                <Player.Root src={getSrc(dragverseCard.playbackUrl)}>
                  <Player.Container>
                    <Player.Video title={dragverseCard.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    <Player.Controls className="flex items-center justify-center">
                      <Player.PlayPauseTrigger className="w-14 h-14 flex items-center justify-center rounded-full bg-[#EB83EA]/90 hover:bg-[#E748E6] transition-all">
                        <Player.PlayingIndicator asChild matcher={false}><span><PlayIcon /></span></Player.PlayingIndicator>
                        <Player.PlayingIndicator asChild matcher={true}><span><PauseIcon /></span></Player.PlayingIndicator>
                      </Player.PlayPauseTrigger>
                    </Player.Controls>
                  </Player.Container>
                </Player.Root>
              </div>
              {/* Info row */}
              <Link href={`/watch/${dragverseCard.id}`} className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Image src="/logo.svg" alt="" width={10} height={10} />
                    <span className="text-purple-300 text-[10px] font-semibold uppercase">Dragverse</span>
                    <span className="text-gray-600 text-[10px]">·</span>
                    <span className="text-gray-400 text-[10px] uppercase">{contentLabel}</span>
                  </div>
                  <p className="text-white text-sm font-semibold line-clamp-1 group-hover:text-[#EB83EA] transition-colors">{dragverseCard.title}</p>
                  <p className="text-gray-400 text-xs">{cardCreator}</p>
                </div>
                <FiExternalLink className="w-4 h-4 text-gray-500 group-hover:text-[#EB83EA] transition-colors flex-shrink-0 ml-2" />
              </Link>
            </div>
          );
        }

        // Thumbnail-only fallback
        return (
          <Link
            href={`/watch/${dragverseCard.id}`}
            className="mb-4 block rounded-xl overflow-hidden border border-[#EB83EA]/20 hover:border-[#EB83EA]/50 transition-all bg-[#0f071a] group"
          >
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              <Image src={cardThumbnail} alt={dragverseCard.title} fill className="object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/default-thumbnail.jpg"; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-[#EB83EA]/80 transition-all">
                  <PlayIcon />
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Image src="/logo.svg" alt="" width={10} height={10} />
                <span className="text-purple-300 text-[10px] font-semibold uppercase">Dragverse</span>
                <span className="text-gray-600 text-[10px]">·</span>
                <span className="text-gray-400 text-[10px] uppercase">{contentLabel}</span>
              </div>
              <p className="text-white font-semibold text-sm line-clamp-1 group-hover:text-[#EB83EA] transition-colors">{dragverseCard.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">{cardCreator}</p>
            </div>
          </Link>
        );
      })()}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[#2f2942]">
        <EngagementBar
          compact
          contentId={post.id}
          contentType="post"
          likes={likeCount}
          comments={commentCount}
          isLiked={isLiked}
          onLike={toggleLike}
          onComment={() => setIsCommentModalOpen(true)}
        />

        <div className="flex items-center gap-4 text-gray-400 text-sm">
          <button
            onClick={toggleBookmark}
            className={`flex items-center gap-1.5 transition-colors ${
              isBookmarked ? "text-[#EB83EA]" : "hover:text-[#EB83EA]"
            }`}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          >
            <FiBookmark className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`} />
          </button>
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
              className="flex items-center gap-1.5 hover:text-[#EB83EA] transition-colors"
              aria-label="Watch on YouTube"
            >
              <FiExternalLink className="w-4 h-4" />
            </a>
          )}
          {((post as any).source === "dragverse" || (post as any).source === "ceramic") && post.id && post.playbackUrl && (
            <Link
              href={`/watch/${post.id}`}
              className="flex items-center gap-1.5 hover:text-[#EB83EA] transition-colors"
              aria-label="Watch on Dragverse"
            >
              <FiExternalLink className="w-4 h-4" />
            </Link>
          )}
          {(post as any).source !== "youtube" && (post as any).source !== "dragverse" && (post as any).source !== "ceramic" && post.externalUrl && (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#EB83EA] transition-colors"
              aria-label="View on Bluesky"
            >
              <FiExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>

    {/* Comment Modal */}
    <CommentModal
      isOpen={isCommentModalOpen}
      onClose={() => setIsCommentModalOpen(false)}
      postUri={post.uri || `dragverse:${post.id}`}
      postCid={post.cid || ""}
      postAuthor={{
        displayName: post.creator.displayName,
        handle: post.creator.handle,
      }}
      onCommentPosted={() => setCommentCount(prev => prev + 1)}
    />
    </>
  );
}
