"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import { useRouter } from "next/navigation";
import { FiVideo, FiHeart, FiUsers, FiEye, FiCopy, FiEdit, FiTrash2, FiZap, FiRadio, FiDownload, FiUpload } from "react-icons/fi";
import Image from "next/image";
import { useState, useEffect } from "react";
import { getVideosByCreator, type SupabaseVideo } from "@/lib/supabase/videos";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { Video } from "@/types";
import { transformVideosWithCreators } from "@/lib/supabase/transform-video";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";
import { StatsCard, ActionButton, EmptyState, LoadingShimmer } from "@/components/shared";
import { useCanLivestream } from "@/lib/livestream";
import { StreamModal } from "@/components/dashboard/stream-modal";

interface StreamRecording {
  id: string;
  title: string;
  recorded_at: string;
  duration_seconds: number;
  status: string;
  is_published: boolean;
  download_url?: string;
  playback_url?: string;
  thumbnail?: string;
  views: number;
}

export default function DashboardPage() {
  const { isAuthenticated, signIn, user } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const { canStream } = useCanLivestream();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalFollowers: 0,
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [recordings, setRecordings] = useState<StreamRecording[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingRecording, setDeletingRecording] = useState<string | null>(null);
  const [showStreamModal, setShowStreamModal] = useState(false);

  // Load dashboard data from Supabase
  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.id) return;

      setLoading(true);
      try {
        // CRITICAL FIX: Get the verified user ID from the backend
        // This ensures we use the same identifier that was stored during video upload
        const authToken = await getAccessToken();

        let verifiedUserId = user.id; // Fallback to client ID

        try {
          const meResponse = await fetch("/api/user/me", {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();
            verifiedUserId = meData.userId; // Use the verified ID from JWT
            console.log("✅ Using verified user ID:", verifiedUserId);
          } else {
            console.warn("⚠️  Could not verify user ID, using client ID as fallback");
          }
        } catch (error) {
          console.error("Failed to get verified user ID:", error);
        }

        // Fetch user's videos from Supabase using the verified DID
        // This matches the creator_did that was stored during upload
        const supabaseVideos = await getVideosByCreator(verifiedUserId);

        // Transform Supabase videos with proper creator data and placeholder thumbnails
        const transformedVideos = await transformVideosWithCreators(supabaseVideos);

        setVideos(transformedVideos);

        // Calculate statistics from videos
        const totalViews = supabaseVideos.reduce((sum: number, v: SupabaseVideo) => sum + (v.views || 0), 0);
        const totalLikes = supabaseVideos.reduce((sum: number, v: SupabaseVideo) => sum + (v.likes || 0), 0);

        // Fetch creator profile for follower count
        let totalFollowers = 0;
        try {
          const creator = await getCreatorByDID(verifiedUserId);
          totalFollowers = creator?.follower_count || 0;
        } catch (error) {
          console.warn("Could not fetch creator profile:", error);
        }

        setStats({
          totalViews,
          totalLikes,
          totalFollowers,
        });

        // Fetch stream recordings if user can livestream
        if (canStream) {
          try {
            const recordingsResponse = await fetch("/api/stream/recordings", {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            if (recordingsResponse.ok) {
              const recordingsData = await recordingsResponse.json();
              setRecordings(recordingsData.recordings || []);
            }
          } catch (error) {
            console.warn("Could not fetch recordings:", error);
          }
        }
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
  }, [isAuthenticated, user?.id, canStream]);

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

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    setDeleting(videoId);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/video/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      // Remove video from state
      setVideos(videos.filter(v => v.id !== videoId));
      toast.success("Video deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete video");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (!confirm("Are you sure you want to delete this recording? This action cannot be undone.")) {
      return;
    }

    setDeletingRecording(recordingId);
    try {
      const authToken = await getAccessToken();
      const response = await fetch(`/api/stream/recordings?id=${recordingId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete recording");
      }

      // Remove recording from state
      setRecordings(recordings.filter(r => r.id !== recordingId));
      toast.success("Recording deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete recording");
    } finally {
      setDeletingRecording(null);
    }
  };

  const handleDownloadRecording = (downloadUrl: string, title: string) => {
    if (!downloadUrl) {
      toast.error("Download URL not available");
      return;
    }

    // Open download URL in new tab
    window.open(downloadUrl, "_blank");
    toast.success(`Downloading: ${title}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <LoadingShimmer className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
          </div>
          <LoadingShimmer aspectRatio="video" className="h-96" />
        </div>
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
        {/* Header with sparkles */}
        <div className="mb-8 relative">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
              <FiZap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-widest bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                Your Kingdom
              </h1>
              <p className="text-gray-400 text-sm">Where your magic comes to life</p>
            </div>
          </div>
          <div className="absolute -top-2 right-0 text-yellow-300/40 text-3xl animate-pulse">✨</div>
        </div>

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={<FiEye className="w-6 h-6 text-white" />}
            label="Total Views"
            value={stats.totalViews.toLocaleString()}
            gradient="from-blue-500/10 via-purple-500/10 to-pink-500/10"
          />
          <StatsCard
            icon={<FiHeart className="w-6 h-6 text-white" />}
            label="Hearts Received"
            value={stats.totalLikes.toLocaleString()}
            gradient="from-pink-500/10 via-rose-500/10 to-red-500/10"
          />
          <StatsCard
            icon={<FiUsers className="w-6 h-6 text-white" />}
            label="Loyal Subjects"
            value={stats.totalFollowers.toLocaleString()}
            gradient="from-purple-500/10 via-indigo-500/10 to-blue-500/10"
          />
          <StatsCard
            icon={<FiVideo className="w-6 h-6 text-white" />}
            label="Content Pieces"
            value={videos.length.toLocaleString()}
            gradient="from-green-500/10 via-emerald-500/10 to-teal-500/10"
          />
        </div>

        {/* Video Management Section */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 md:p-8 border-2 border-[#EB83EA]/10 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold uppercase tracking-wide mb-2">
                Your Performances
              </h2>
              <p className="text-gray-400">All your fabulous content in one place</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canStream && (
                <button
                  onClick={() => setShowStreamModal(true)}
                  className="px-8 py-4 text-lg rounded-full font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02]"
                >
                  <FiRadio className="w-5 h-5" />
                  Go Live
                </button>
              )}
              <ActionButton
                onClick={() => router.push('/upload')}
                icon={<FiVideo className="w-5 h-5" />}
                size="lg"
              >
                Upload New
              </ActionButton>
            </div>
          </div>

          {/* Videos Grid */}
          <div className="space-y-4">
            {videos.length === 0 ? (
              <EmptyState
                icon="🎬"
                title="No Looks Yet"
                description="Ready for your close-up? Upload your first video and start building your empire!"
                actionLabel="Upload Your First Look"
                onAction={() => router.push('/upload')}
              />
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-5 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all hover:shadow-lg hover:shadow-[#EB83EA]/10 group"
                >
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Thumbnail */}
                    <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20 group-hover:border-[#EB83EA]/40 transition-all">
                      <Image
                        src={video.thumbnail && video.thumbnail.trim() !== '' ? video.thumbnail : '/default-thumbnail.jpg'}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 px-3 py-1 bg-[#EB83EA] text-white text-xs font-bold rounded-full shadow-lg">
                        {video.contentType === 'short' ? 'SNAPSHOT' : video.contentType === 'podcast' || video.contentType === 'music' ? 'AUDIO' : 'VIDEO'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl mb-3 text-white group-hover:text-[#EB83EA] transition-colors">
                        {video.title}
                      </h3>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FiEye className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-semibold">{(video.views || 0).toLocaleString()}</span>
                          <span className="text-xs">views</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                            <FiHeart className="w-4 h-4 text-pink-400" />
                          </div>
                          <span className="font-semibold">{(video.likes || 0).toLocaleString()}</span>
                          <span className="text-xs">hearts</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <span className="text-xs">Uploaded {new Date(video.createdAt).toLocaleDateString()}</span>
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => copyShareLink(video.id)}
                          className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                        >
                          <FiCopy className="w-4 h-4" />
                          {copiedId === video.id ? '✓ Copied!' : 'Share'}
                        </button>
                        <button
                          onClick={() => router.push(`/watch/${video.id}`)}
                          className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                        >
                          <FiEye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/upload?edit=${video.id}`)}
                          className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                        >
                          <FiEdit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          disabled={deleting === video.id}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiTrash2 className="w-4 h-4" />
                          {deleting === video.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stream Recordings Section - Only show if user can livestream */}
        {canStream && recordings.length > 0 && (
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 md:p-8 border-2 border-[#EB83EA]/10 shadow-xl mt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold uppercase tracking-wide mb-2 flex items-center gap-2">
                  <FiRadio className="w-6 h-6 text-red-500" />
                  Stream Recordings
                </h2>
                <p className="text-gray-400">Manage your recorded livestreams</p>
              </div>
            </div>

            {/* Recordings Grid */}
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-5 border-2 border-red-500/10 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/10 group"
                >
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Thumbnail */}
                    <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden flex-shrink-0 border-2 border-red-500/20 group-hover:border-red-500/40 transition-all">
                      <Image
                        src={recording.thumbnail || '/default-thumbnail.jpg'}
                        alt={recording.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                        <FiRadio className="w-3 h-3" />
                        {recording.status === 'ready' ? 'RECORDED' : recording.status.toUpperCase()}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl mb-3 text-white group-hover:text-red-400 transition-colors">
                        {recording.title}
                      </h3>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FiEye className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-semibold">{(recording.views || 0).toLocaleString()}</span>
                          <span className="text-xs">views</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <span className="text-xs">Recorded {new Date(recording.recorded_at).toLocaleDateString()}</span>
                        </span>
                        {recording.duration_seconds && (
                          <span className="flex items-center gap-1.5 text-gray-400">
                            <span className="text-xs">{Math.floor(recording.duration_seconds / 60)} minutes</span>
                          </span>
                        )}
                        {recording.is_published && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full flex items-center gap-1">
                            <FiUpload className="w-3 h-3" />
                            Published
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {recording.download_url && recording.status === 'ready' && (
                          <button
                            onClick={() => handleDownloadRecording(recording.download_url!, recording.title)}
                            className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                          >
                            <FiDownload className="w-4 h-4" />
                            Download
                          </button>
                        )}
                        {recording.playback_url && (
                          <button
                            onClick={() => window.open(recording.playback_url, '_blank')}
                            className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                          >
                            <FiEye className="w-4 h-4" />
                            Watch
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecording(recording.id)}
                          disabled={deletingRecording === recording.id}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiTrash2 className="w-4 h-4" />
                          {deletingRecording === recording.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Livestream Modal */}
      {showStreamModal && canStream && (
        <StreamModal onClose={() => setShowStreamModal(false)} />
      )}
    </div>
  );
}
