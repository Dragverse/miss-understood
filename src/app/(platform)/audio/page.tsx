"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiHeadphones, FiPlay, FiClock, FiTrendingUp, FiMusic, FiMic, FiUser } from "react-icons/fi";
import { LoadingShimmer } from "@/components/shared";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

interface AudioContent {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  views: number;
  createdAt: Date;
  creator: {
    displayName: string;
    handle: string;
    avatar: string;
  };
  youtubeUrl: string;
  type: "podcast" | "music";
  source?: "youtube" | "dragverse";
}

export default function AudioPage() {
  const router = useRouter();
  const { playTrack, pause: pauseAudio } = useAudioPlayer();
  const [audioContent, setAudioContent] = useState<AudioContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "podcasts" | "music">("all");
  const [selectedVideo, setSelectedVideo] = useState<AudioContent | null>(null);

  // Pause audio when video modal opens
  useEffect(() => {
    if (selectedVideo) {
      pauseAudio();
    }
  }, [selectedVideo, pauseAudio]);

  useEffect(() => {
    loadAudioContent();
  }, []);

  async function loadAudioContent() {
    setLoading(true);
    try {
      const allContent: AudioContent[] = [];

      // 1. Fetch uploaded audio from Dragverse database (podcast & music content types)
      try {
        const dbResponse = await fetch("/api/youtube/feed?includeDatabase=true");
        const dbData = await dbResponse.json();

        if (dbData.success && dbData.videos) {
          // Filter for audio content types (podcast, music)
          const audioVideos = dbData.videos.filter((v: any) =>
            v.contentType === 'podcast' || v.contentType === 'music'
          );

          audioVideos.forEach((v: any) => {
            allContent.push({
              id: v.id,
              title: v.title,
              description: v.description || "",
              thumbnail: v.thumbnail || "/default-thumbnail.jpg",
              duration: v.duration || 0,
              views: v.views || 0,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              creator: v.creator || {
                displayName: "Creator",
                handle: "creator",
                avatar: "/default-avatar.jpg",
              },
              youtubeUrl: v.playbackUrl || "", // Use playback URL for uploaded audio
              type: v.contentType === 'podcast' ? 'podcast' : 'music',
              source: 'dragverse', // Mark as uploaded content
            });
          });

          console.log(`[Audio] Loaded ${audioVideos.length} uploaded audio items from database`);
        }
      } catch (dbError) {
        console.error("[Audio] Failed to fetch database audio:", dbError);
      }

      // 2. Fetch YouTube videos from RSS feeds (no API quota!) + music playlists
      const response = await fetch("/api/youtube/feed?limit=50&rssOnly=true&includePlaylists=true");
      const data = await response.json();

      if (data.success && data.videos) {
        // Since RSS doesn't provide duration, we'll categorize by keywords in titles
        // and show all drag music/performance content

        const musicKeywords = ['music', 'song', 'performance', 'singing', 'cover', 'acoustic', 'live'];
        const podcastKeywords = ['podcast', 'interview', 'talk', 'discussion', 'episode', 'chat'];

        data.videos.forEach((v: any) => {
          const titleLower = v.title?.toLowerCase() || "";
          const descLower = v.description?.toLowerCase() || "";

          // Determine type based on keywords
          let type: "music" | "podcast" = "music"; // Default to music

          if (podcastKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword))) {
            type = "podcast";
          }

          allContent.push({
            id: v.id,
            title: v.title,
            description: v.description || "",
            thumbnail: v.thumbnail || "/default-thumbnail.jpg",
            duration: v.duration || 0,
            views: v.views || 0,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            creator: v.creator || {
              displayName: "YouTube Creator",
              handle: "youtube",
              avatar: "/default-thumbnail.jpg",
            },
            youtubeUrl: v.externalUrl || v.playbackUrl || "",
            type,
            source: 'youtube',
          });
        });
      }

      // Sort by date (newest first)
      allContent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(`[Audio] Loaded ${allContent.length} audio items from YouTube RSS (${allContent.filter(c => c.type === 'podcast').length} podcasts, ${allContent.filter(c => c.type === 'music').length} music)`);

      setAudioContent(allContent);
    } catch (error) {
      console.error("Failed to load audio content:", error);
    } finally {
      setLoading(false);
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredContent = audioContent.filter((content) => {
    if (activeTab === "all") return true;
    if (activeTab === "podcasts") return content.type === "podcast";
    if (activeTab === "music") return content.type === "music";
    return true;
  });

  const handlePlayTrack = (content: AudioContent) => {
    // For YouTube content, we'll play it as a video since RSS doesn't provide audio-only URLs
    // Extract YouTube video ID from the URL
    const youtubeIdMatch = content.youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : "";

    if (youtubeId) {
      setSelectedVideo(content);
    }
  };

  const closeVideoPlayer = () => {
    setSelectedVideo(null);
  };

  return (
    <>
      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-2xl font-bold">{selectedVideo.title}</h2>
              <button
                onClick={closeVideoPlayer}
                className="text-white text-4xl hover:text-[#EB83EA] transition-colors"
              >
                ×
              </button>
            </div>
            <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${selectedVideo.youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]}?autoplay=1`}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-4 text-gray-400">
              <p>{selectedVideo.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <FiTrendingUp className="w-4 h-4" />
                  {selectedVideo.views.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1">
                  <FiClock className="w-4 h-4" />
                  {formatDuration(selectedVideo.duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiHeadphones className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-3xl lg:text-4xl uppercase tracking-wide font-black">
                Bangers & Podcasts
              </h1>
              <p className="text-gray-400 text-sm">
                Listen to music or podcasts from our creators and around the Internet.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-2 border-2 border-[#EB83EA]/10 mb-8 inline-flex gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === "all"
                ? "bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setActiveTab("podcasts")}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeTab === "podcasts"
                ? "bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FiMic className="w-5 h-5" />
            PODCASTS
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeTab === "music"
                ? "bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FiMusic className="w-5 h-5" />
            MUSIC
          </button>
        </div>

        {/* Audio Grid - Improved Album Style */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {[...Array(12)].map((_, i) => (
              <LoadingShimmer key={i} aspectRatio="square" className="h-auto" />
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 flex items-center justify-center mx-auto mb-6">
              <FiHeadphones className="w-10 h-10 text-[#EB83EA]" />
            </div>
            <h3 className="text-white text-2xl font-bold mb-3 uppercase tracking-wide">The Soundcheck is Silent</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              No bangers or podcasts on the airwaves yet. Check back soon for fresh drag music and conversations!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {filteredContent.map((content) => (
              <button
                key={content.id}
                onClick={() => {
                  // Navigate to /listen/[id] for uploaded Dragverse audio, YouTube modal for RSS content
                  if (content.source === 'dragverse') {
                    router.push(`/listen/${content.id}`);
                  } else {
                    handlePlayTrack(content);
                  }
                }}
                className="group text-left w-full"
              >
                {/* Album Art - Square with hover effect */}
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-gradient-to-br from-[#18122D] to-[#1a0b2e] shadow-lg">
                  <Image
                    src={content.thumbnail}
                    alt={content.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-[#EB83EA] flex items-center justify-center shadow-xl">
                      <FiPlay className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-[#EB83EA]/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                    {content.type === "podcast" ? (
                      <>
                        <FiMic className="w-2.5 h-2.5" />
                        POD
                      </>
                    ) : (
                      <>
                        <FiMusic className="w-2.5 h-2.5" />
                        MUSIC
                      </>
                    )}
                  </div>

                  {/* Duration Badge */}
                  {content.duration > 0 && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg flex items-center gap-1">
                      <FiClock className="w-2.5 h-2.5" />
                      {formatDuration(content.duration)}
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="space-y-1">
                  {/* Title */}
                  <h3 className="font-bold text-sm text-white group-hover:text-[#EB83EA] transition-colors line-clamp-2 leading-tight">
                    {content.title}
                  </h3>

                  {/* Creator */}
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <FiUser className="w-3 h-3 flex-shrink-0" />
                    {content.creator.displayName}
                  </p>

                  {/* Views */}
                  {content.views > 0 && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <FiTrendingUp className="w-3 h-3" />
                      {content.views.toLocaleString()}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </>
  );
}
