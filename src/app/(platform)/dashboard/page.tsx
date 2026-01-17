"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import { useRouter } from "next/navigation";
import { FiVideo, FiHeart, FiUsers, FiEye, FiCopy, FiEdit, FiTrash2 } from "react-icons/fi";
import Image from "next/image";
import { useState, useEffect } from "react";
import { getVideosByCreatorDID } from "@/lib/ceramic/videos";
import { getCreatorByDID } from "@/lib/ceramic/creators";
import { Video } from "@/types";

export default function DashboardPage() {
  const { isAuthenticated, signIn, user } = useAuthUser();
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalFollowers: 0,
  });
  const [videos, setVideos] = useState<Video[]>([]);

  // Load dashboard data from Ceramic
  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Fetch user's videos from Ceramic
        const userVideos = await getVideosByCreatorDID(user.id);
        setVideos(userVideos);

        // Calculate statistics from videos
        const totalViews = userVideos.reduce((sum: number, v: Video) => sum + (v.views || 0), 0);
        const totalLikes = userVideos.reduce((sum: number, v: Video) => sum + (v.likes || 0), 0);

        // Fetch creator profile for follower count
        let totalFollowers = 0;
        try {
          const creator = await getCreatorByDID(user.id);
          totalFollowers = creator?.followerCount || 0;
        } catch (error) {
          console.warn("Could not fetch creator profile:", error);
        }

        setStats({
          totalViews,
          totalLikes,
          totalFollowers,
        });
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // Keep zeros if data fetch fails
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, user?.id]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Sign in to view your dashboard</h1>
          <p className="text-gray-400 mb-6">Track your content and analytics</p>
          <button
            onClick={signIn}
            className="px-8 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-full transition"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const copyShareLink = (videoId: string) => {
    const link = `${window.location.origin}/watch/${videoId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-tight mb-2">
            Creator <span className="text-[#EB83EA] italic">Dashboard</span>
          </h1>
          <p className="text-gray-400">Manage your content and track your performance</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Total Views */}
          <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] rounded-[24px] p-6 border border-[#2f2942]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <FiEye className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats.totalViews.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Views</div>
          </div>

          {/* Total Likes */}
          <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] rounded-[24px] p-6 border border-[#2f2942]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
                <FiHeart className="w-6 h-6 text-pink-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats.totalLikes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Likes</div>
          </div>

          {/* Followers */}
          <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] rounded-[24px] p-6 border border-[#2f2942]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <FiUsers className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              {stats.totalFollowers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Followers</div>
          </div>
        </div>

        {/* Video Management */}
        <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] rounded-[24px] p-6 border border-[#2f2942]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">Your Videos</h2>
              <p className="text-gray-400 text-sm">Manage and track your uploaded content</p>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="px-6 py-2.5 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-full transition flex items-center gap-2"
            >
              <FiVideo className="w-4 h-4" />
              Upload New
            </button>
          </div>

          {/* Videos Table */}
          <div className="space-y-4">
            {videos.length === 0 ? (
              <div className="text-center py-12">
                <FiVideo className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-bold text-gray-300 mb-2">No videos yet</h3>
                <p className="text-gray-500 mb-6">Upload your first video to get started!</p>
                <button
                  onClick={() => router.push('/upload')}
                  className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white font-bold rounded-full transition"
                >
                  Upload Now
                </button>
              </div>
            ) : (
              videos.map((video) => (
              <div
                key={video.id}
                className="bg-white/5 rounded-2xl p-4 hover:bg-white/10 transition group"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-32 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={video.thumbnail || '/placeholder-video.jpg'}
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                      READY
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg mb-1 truncate">{video.title}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-2">
                      <span className="flex items-center gap-1">
                        <FiEye className="w-4 h-4" />
                        {(video.views || 0).toLocaleString()} views
                      </span>
                      <span className="flex items-center gap-1">
                        <FiHeart className="w-4 h-4" />
                        {(video.likes || 0).toLocaleString()} likes
                      </span>
                      <span>Uploaded: {new Date(video.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyShareLink(video.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                      >
                        <FiCopy className="w-3 h-3" />
                        {copiedId === video.id ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                        <FiEdit className="w-3 h-3" />
                        Edit
                      </button>
                      <button className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                        <FiTrash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
