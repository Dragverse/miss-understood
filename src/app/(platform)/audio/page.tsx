"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiHeadphones, FiPlay, FiClock, FiTrendingUp, FiMusic, FiMic } from "react-icons/fi";
import { LoadingShimmer } from "@/components/shared";

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
}

export default function AudioPage() {
  const router = useRouter();
  const [audioContent, setAudioContent] = useState<AudioContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "podcasts" | "music">("all");

  useEffect(() => {
    loadAudioContent();
  }, []);

  async function loadAudioContent() {
    setLoading(true);
    try {
      // Fetch YouTube videos from RSS feeds (no API quota!)
      // Get enough videos to filter for podcasts and music
      const response = await fetch("/api/youtube/feed?limit=50&rssOnly=true");
      const data = await response.json();

      const allContent: AudioContent[] = [];

      if (data.success && data.videos) {
        // Categorize by duration:
        // - Podcasts: 30+ minutes (1800+ seconds)
        // - Music: 2-10 minutes (120-600 seconds)

        const podcasts = data.videos
          .filter((v: any) => v.duration > 1800) // 30 minutes+
          .map((v: any) => ({
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
            type: "podcast" as const,
          }));

        const music = data.videos
          .filter((v: any) => v.duration >= 120 && v.duration <= 600) // 2-10 minutes
          .map((v: any) => ({
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
            type: "music" as const,
          }));

        allContent.push(...podcasts, ...music);
      }

      // Sort by views (most popular first)
      allContent.sort((a, b) => b.views - a.views);

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

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiHeadphones className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Audio
              </h1>
              <p className="text-gray-400 text-sm">
                Drag podcasts, music, and performances
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

        {/* Audio Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingShimmer key={i} aspectRatio="video" className="h-72" />
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 flex items-center justify-center mx-auto mb-6">
              <FiHeadphones className="w-10 h-10 text-[#EB83EA]" />
            </div>
            <h3 className="text-white text-2xl font-bold mb-3">No Audio Content Available</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              We're currently fetching drag podcasts and music from YouTube.
              Check back in a few moments, or try refreshing the page!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((content) => (
              <a
                key={content.id}
                href={content.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl overflow-hidden border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all cursor-pointer hover:shadow-lg hover:shadow-[#EB83EA]/20"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video">
                  <Image
                    src={content.thumbnail}
                    alt={content.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-[#EB83EA]/90 flex items-center justify-center">
                      <FiPlay className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/80 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {formatDuration(content.duration)}
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-[#EB83EA] text-white text-xs font-bold rounded-full uppercase flex items-center gap-1">
                    {content.type === "podcast" ? (
                      <>
                        <FiMic className="w-3 h-3" />
                        PODCAST
                      </>
                    ) : (
                      <>
                        <FiMusic className="w-3 h-3" />
                        MUSIC
                      </>
                    )}
                  </div>
                </div>

                {/* Content Info */}
                <div className="p-5">
                  {/* Creator */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20">
                      <Image
                        src={content.creator.avatar}
                        alt={content.creator.displayName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {content.creator.displayName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        @{content.creator.handle}
                      </p>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-lg mb-2 text-white group-hover:text-[#EB83EA] transition-colors line-clamp-2">
                    {content.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {content.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <FiTrendingUp className="w-4 h-4" />
                      <span>{content.views.toLocaleString()} views</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
