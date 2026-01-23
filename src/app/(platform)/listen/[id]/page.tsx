"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMessageCircle, FiShare2, FiPlay, FiPause, FiSkipForward, FiSkipBack, FiVolume2 } from "react-icons/fi";
import { TipModal } from "@/components/video/tip-modal";
import { ShareModal } from "@/components/video/share-modal";
import { VideoCommentModal } from "@/components/video/video-comment-modal";
import { ChocolateBar } from "@/components/ui/chocolate-bar";
import { getVideo } from "@/lib/supabase/videos";
import { Video } from "@/types";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";
import { HeartAnimation, LoadingShimmer, MoodBadge } from "@/components/shared";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

export default function ListenPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const { getAccessToken, login, user } = usePrivy();
  const { playTrack, pause, resume, isPlaying: isGlobalPlaying, currentTrack, audioRef } = useAudioPlayer();

  const [audio, setAudio] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Fetch audio from database
  useEffect(() => {
    async function loadAudio() {
      try {
        const audioDoc = await getVideo(resolvedParams.id);

        if (audioDoc) {
          // Transform to Video type with creator info
          const transformedAudio = await transformVideoWithCreator(audioDoc);
          setAudio(transformedAudio);
          setLikes(transformedAudio.likes || 0);
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
  }, [resolvedParams.id]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingShimmer aspectRatio="square" className="w-96 h-96" />
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Audio Player Card */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-8 border-2 border-[#EB83EA]/20 mb-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Album Art */}
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-[#EB83EA]/20">
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
            </div>

            {/* Audio Info & Controls */}
            <div className="space-y-6">
              {/* Title & Artist */}
              <div>
                <h1 className="text-4xl font-bold text-white mb-3">{audio.title}</h1>
                <Link
                  href={`/profile/${audio.creator?.handle || audio.creator?.did}`}
                  className="flex items-center gap-3 group w-fit"
                >
                  <Image
                    src={audio.creator?.avatar || "/default-avatar.jpg"}
                    alt={audio.creator?.displayName || "Creator"}
                    width={48}
                    height={48}
                    className="rounded-full border-2 border-[#EB83EA]/30"
                  />
                  <div>
                    <p className="text-[#EB83EA] font-semibold group-hover:underline">
                      {audio.creator?.displayName}
                    </p>
                    <p className="text-gray-400 text-sm">@{audio.creator?.handle}</p>
                  </div>
                </Link>
              </div>

              {/* Playback Controls */}
              <div className="space-y-4">
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

                {/* Play/Pause Button */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-[#EB83EA]/50"
                  >
                    {isPlaying ? (
                      <FiPause className="w-10 h-10 text-white" />
                    ) : (
                      <FiPlay className="w-10 h-10 text-white ml-1" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCommentModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] rounded-full transition"
                >
                  <FiMessageCircle className="w-5 h-5 text-[#EB83EA]" />
                  <span className="text-white font-semibold">0</span>
                </button>
                <ChocolateBar
                  initialCount={likes}
                  onLike={handleLike}
                  isLiked={isLiked}
                />
                <button
                  onClick={() => setShareModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2f2942] hover:bg-[#3f3952] rounded-full transition"
                >
                  <FiShare2 className="w-5 h-5 text-[#EB83EA]" />
                  <span className="text-white font-semibold">Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {audio.description && (
            <div className="mt-8 pt-8 border-t border-[#EB83EA]/10">
              <h2 className="text-xl font-bold text-white mb-3">About</h2>
              <p className="text-gray-300 leading-relaxed">{audio.description}</p>
            </div>
          )}

          {/* Tags */}
          {audio.tags && audio.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
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
      </div>

      {/* Modals */}
      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        creatorName={audio.creator?.displayName || "Creator"}
        creatorDID={audio.creator?.did || ""}
        videoId={audio.id}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        videoId={audio.id}
        videoTitle={audio.title}
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
