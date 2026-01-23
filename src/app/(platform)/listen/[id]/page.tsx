"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMessageCircle, FiShare2, FiPlay, FiPause, FiSkipForward, FiSkipBack, FiVolume2 } from "react-icons/fi";
import { ShareModal } from "@/components/video/share-modal";
import { VideoCommentModal } from "@/components/video/video-comment-modal";
import { VideoOptionsMenu } from "@/components/video/video-options-menu";
import { getVideo, incrementVideoViews } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HeartAnimation, LoadingShimmer, MoodBadge } from "@/components/shared";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

export default function ListenPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: { token?: string } }) {
  const resolvedParams = React.use(params);
  const shareToken = searchParams.token;
  const router = useRouter();
  const { getAccessToken, login, user } = usePrivy();
  const { playTrack, pause, resume, isPlaying: isGlobalPlaying, currentTrack, audioRef } = useAudioPlayer();

  const [audio, setAudio] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [relatedAudio, setRelatedAudio] = useState<Video[]>([]);

  const isOwner = !!(user?.id && audio?.creator?.did && audio.creator.did === user.id);

  // Fetch audio from database
  useEffect(() => {
    async function loadAudio() {
      try {
        // Check access via API (includes privacy check)
        const authToken = await getAccessToken().catch(() => null);

        const accessUrl = new URL(`/api/video/access/${resolvedParams.id}`, window.location.origin);
        if (shareToken) {
          accessUrl.searchParams.set("token", shareToken);
        }

        const accessResponse = await fetch(accessUrl.toString(), {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });

        if (!accessResponse.ok) {
          const accessData = await accessResponse.json();

          if (accessResponse.status === 403) {
            // Access denied
            setAccessDenied(true);
            setAudio(null);
            setIsLoading(false);
            return;
          }

          // Audio not found
          setAudio(null);
          setIsLoading(false);
          return;
        }

        const audioDoc = await getVideo(resolvedParams.id);

        if (audioDoc) {
          // Transform to Video type with creator info
          const transformedAudio = await transformVideoWithCreator(audioDoc);
          setAudio(transformedAudio);
          setLikes(transformedAudio.likes || 0);

          // Increment view count for Dragverse audio
          if (transformedAudio.source === 'ceramic') {
            try {
              await incrementVideoViews(resolvedParams.id);
              console.log("[Listen] View count incremented for audio:", resolvedParams.id);
            } catch (error) {
              console.error("[Listen] Failed to increment view count:", error);
              // Don't block page load on view count failure
            }
          }
        } else {
          setAudio(null);
        }
      } catch (error) {
        console.error("[Listen] Failed to load audio:", error);
        setAudio(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadAudio();
  }, [resolvedParams.id, shareToken, getAccessToken]);

  // Initialize like state from API
  useEffect(() => {
    async function checkUserInteractions() {
      if (!user?.id || !audio?.id) return;

      try {
        // Check if user has liked the audio
        const likeResponse = await fetch(`/api/social/like/check?userDID=${user.id}&videoId=${audio.id}`);
        if (likeResponse.ok) {
          const likeData = await likeResponse.json();
          setIsLiked(likeData.liked || false);
        }
      } catch (error) {
        console.error("[Listen] Failed to check user interactions:", error);
      }
    }

    checkUserInteractions();
  }, [user?.id, audio?.id]);

  // Fetch related audio (similar content type and category)
  useEffect(() => {
    async function fetchRelatedAudio() {
      if (!audio?.id) return;

      try {
        const response = await fetch(`/api/video/related?videoId=${audio.id}&contentType=${audio.contentType}&limit=6`);
        if (response.ok) {
          const data = await response.json();
          setRelatedAudio(data.videos || []);
        }
      } catch (error) {
        console.error("[Listen] Failed to fetch related audio:", error);
      }
    }

    fetchRelatedAudio();
  }, [audio?.id, audio?.contentType]);

  // Play audio when page loads
  useEffect(() => {
    if (audio && audio.playbackUrl) {
      // Create audio track for global player
      const track = {
        id: audio.id,
        title: audio.title,
        artist: audio.creator?.displayName || "Unknown Artist",
        thumbnail: audio.thumbnail || "/default-thumbnail.jpg",
        audioUrl: audio.playbackUrl,
        duration: audio.duration,
        type: "uploaded" as const,
      };

      playTrack(track, [track]); // Play track with single-item playlist
    }
  }, [audio, playTrack]);

  // Sync with global player state
  useEffect(() => {
    if (currentTrack?.id === audio?.id) {
      setIsPlaying(isGlobalPlaying);
    }
  }, [isGlobalPlaying, currentTrack, audio]);

  // Update current time and duration from audio element
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleTimeUpdate = () => setCurrentTime(audioElement.currentTime);
    const handleDurationChange = () => setDuration(audioElement.duration);

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("durationchange", handleDurationChange);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("durationchange", handleDurationChange);
    };
  }, [audioRef]);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (audio && audio.playbackUrl) {
      const track = {
        id: audio.id,
        title: audio.title,
        artist: audio.creator?.displayName || "Unknown Artist",
        thumbnail: audio.thumbnail || "/default-thumbnail.jpg",
        audioUrl: audio.playbackUrl,
        duration: audio.duration,
        type: "uploaded" as const,
      };
      playTrack(track, [track]);
    } else {
      resume();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Please sign in to like content");
      login();
      return;
    }

    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/social/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          videoId: audio?.id,
          userDID: user.id,
          action: isLiked ? "unlike" : "like",
        }),
      });

      if (response.ok) {
        setIsLiked(!isLiked);
        setLikes(isLiked ? likes - 1 : likes + 1);
      } else {
        toast.error("Failed to like audio");
      }
    } catch (error) {
      console.error("Like error:", error);
      toast.error("Failed to like audio");
    }
  };

  const handleEdit = () => {
    router.push(`/upload?edit=${audio?.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this audio? This action cannot be undone.")) {
      return;
    }

    try {
      const authToken = await getAccessToken();
      const response = await fetch(`/api/video/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId: audio?.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete audio");
      }

      toast.success("Audio deleted successfully");
      router.push("/profile");
    } catch (error) {
      console.error("Error deleting audio:", error);
      toast.error("Failed to delete audio. Please try again.");
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/listen/${audio?.id}`;
    if (navigator.share) {
      navigator.share({ title: audio?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingShimmer aspectRatio="square" className="w-96 h-96" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/10 flex items-center justify-center mx-auto mb-6">
            <FiPlay className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-white text-2xl font-bold mb-3">Access Denied</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            This audio is private. You need permission from the creator to listen to it.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-[#EB83EA] text-white rounded-xl hover:bg-[#EB83EA]/90 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 flex items-center justify-center mx-auto mb-6">
            <FiPlay className="w-10 h-10 text-[#EB83EA]" />
          </div>
          <h3 className="text-white text-2xl font-bold mb-3">Audio Not Found</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            This audio track doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Audio Player Card - Centered Music Player Style */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-8 border-2 border-[#EB83EA]/20 mb-8">
          {/* Album Art - Large and Centered */}
          <div className="relative w-full max-w-md mx-auto mb-8">
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-[#EB83EA]/30">
              <Image
                src={audio.thumbnail || "/default-thumbnail.jpg"}
                alt={audio.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Content Type Badge */}
              <div className="absolute top-4 left-4">
                <MoodBadge mood={audio.contentType === 'podcast' ? 'podcast' : 'music'} />
              </div>

              {/* Options Menu */}
              <div className="absolute top-4 right-4 z-10">
                <VideoOptionsMenu
                  video={audio}
                  isOwner={isOwner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onShare={handleShare}
                />
              </div>
            </div>
          </div>

          {/* Track Info - Centered */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{audio.title}</h1>
            <Link
              href={`/profile/${audio.creator?.handle || audio.creator?.did}`}
              className="inline-flex items-center gap-2 group"
            >
              <Image
                src={audio.creator?.avatar || "/default-avatar.jpg"}
                alt={audio.creator?.displayName || "Creator"}
                width={32}
                height={32}
                className="rounded-full border-2 border-[#EB83EA]/30"
              />
              <span className="text-[#EB83EA] font-semibold group-hover:underline">
                {audio.creator?.displayName}
              </span>
            </Link>
          </div>

          {/* Playback Controls - Music Player Style */}
          <div className="space-y-6 mb-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#EB83EA]"
              />
              <div className="flex justify-between text-sm text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Play/Pause Button - Centered */}
            <div className="flex items-center justify-center">
              <button
                onClick={handlePlayPause}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-[#EB83EA]/50"
              >
                {isPlaying ? (
                  <FiPause className="w-8 h-8 text-white" />
                ) : (
                  <FiPlay className="w-8 h-8 text-white ml-1" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons - Centered */}
          <div className="flex items-center justify-center gap-4 pb-6 border-b border-[#EB83EA]/10">
            <HeartAnimation
              initialLiked={isLiked}
              onToggle={handleLike}
              showCount={true}
              count={likes}
            />
            <button
              onClick={() => setCommentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] rounded-full transition"
            >
              <FiMessageCircle className="w-5 h-5 text-[#EB83EA]" />
              <span className="text-white font-semibold">0</span>
            </button>
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] rounded-full transition"
            >
              <FiShare2 className="w-5 h-5 text-[#EB83EA]" />
              <span className="text-white font-semibold">Share</span>
            </button>
          </div>

          {/* Description */}
          {audio.description && (
            <div className="mt-6">
              <h2 className="text-lg font-bold text-white mb-2">About</h2>
              <p className="text-gray-300 leading-relaxed">{audio.description}</p>
            </div>
          )}

          {/* Tags */}
          {audio.tags && audio.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {audio.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-[#EB83EA]/10 text-[#EB83EA] rounded-full text-sm font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Related Audio */}
        {relatedAudio.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-6">More Like This</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedAudio.map((relatedTrack) => (
                <Link
                  key={relatedTrack.id}
                  href={`/listen/${relatedTrack.id}`}
                  className="group bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-2xl p-4 border border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
                    <Image
                      src={relatedTrack.thumbnail || "/default-thumbnail.jpg"}
                      alt={relatedTrack.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition flex items-center justify-center">
                      <FiPlay className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                  <h3 className="text-white font-semibold mb-1 line-clamp-2">{relatedTrack.title}</h3>
                  <p className="text-gray-400 text-sm">{relatedTrack.creator?.displayName}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                    <span>{relatedTrack.views?.toLocaleString() || 0} views</span>
                    <span>•</span>
                    <span>{Math.floor(relatedTrack.duration / 60)}:{String(relatedTrack.duration % 60).padStart(2, '0')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        videoId={audio.id}
        videoTitle={audio.title}
        videoVisibility={audio.visibility || "public"}
        isOwner={user?.id === audio.creator?.did}
      />
      <VideoCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        videoId={audio.id}
        videoTitle={audio.title}
      />
    </div>
  );
}
