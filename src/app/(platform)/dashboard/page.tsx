"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import { useRouter } from "next/navigation";
import {
  FiVideo, FiHeart, FiUsers, FiEye, FiCopy, FiEdit, FiTrash2,
  FiZap, FiRadio, FiDownload, FiUpload, FiAlertTriangle,
  FiCheckCircle, FiWifi, FiXCircle, FiRefreshCw
} from "react-icons/fi";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { getVideosByCreator, type SupabaseVideo } from "@/lib/supabase/videos";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { Video } from "@/types";
import { transformVideosWithCreators } from "@/lib/supabase/transform-video";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";
import { StatsCard, ActionButton, EmptyState, LoadingShimmer } from "@/components/shared";
import { useCanLivestream } from "@/lib/livestream";
import { StreamModal } from "@/components/dashboard/stream-modal";
import { useStreamStore } from "@/lib/store/stream";

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

interface DetectedStream {
  id: string;
  title: string;
  startedAt?: string;
  playbackId: string;
}

type LiveStatus = "checking" | "live" | "stuck" | "none";

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return "";
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export default function DashboardPage() {
  const { isAuthenticated, signIn, user } = useAuthUser();
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const { canStream } = useCanLivestream();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalViews: 0, totalLikes: 0, totalFollowers: 0 });
  const [videos, setVideos] = useState<Video[]>([]);
  const [recordings, setRecordings] = useState<StreamRecording[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingRecording, setDeletingRecording] = useState<string | null>(null);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string>("");
  const { activeStream, clearActiveStream } = useStreamStore();

  // Livestream hub state
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("checking");
  const [detectedStream, setDetectedStream] = useState<DetectedStream | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  // After a clear, suppress re-checks for 12s so Livepeer's isActive has time to settle
  const suppressCheckUntil = useRef<number>(0);

  const checkLiveStatus = useCallback(async (uid: string) => {
    if (Date.now() < suppressCheckUntil.current) return;
    try {
      const res = await fetch(`/api/stream/by-creator?creatorDID=${encodeURIComponent(uid)}`);
      if (!res.ok) { setLiveStatus("none"); return; }
      const data = await res.json();

      if (data.streams && data.streams.length > 0) {
        const s = data.streams[0];
        setDetectedStream({
          id: s.id,
          title: s.name || "Unnamed Stream",
          startedAt: s.startedAt,
          playbackId: s.playbackId,
        });
        if (activeStream && activeStream.creatorDID === uid) {
          setLiveStatus("live");
        } else {
          setLiveStatus("stuck");
        }
      } else {
        setDetectedStream(null);
        if (activeStream && activeStream.creatorDID === uid) {
          clearActiveStream();
        }
        setLiveStatus("none");
      }
    } catch {
      setLiveStatus("none");
    }
  }, [activeStream, clearActiveStream]);

  const handleClearAll = useCallback(async () => {
    // Immediately update UI — don't wait for API
    setIsClearing(true);
    setLiveStatus("none");
    setDetectedStream(null);
    clearActiveStream();
    // Suppress re-checks for 12 seconds so Livepeer's isActive can settle
    suppressCheckUntil.current = Date.now() + 12_000;
    try {
      const authToken = await getAccessToken();
      await fetch("/api/stream/clear-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      toast.success("Stream cleared — ready to go live fresh.");
    } catch {
      toast.error("Failed to clear streams. Try again.");
    } finally {
      setIsClearing(false);
    }
  }, [getAccessToken, clearActiveStream]);

  // Load dashboard data
  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const authToken = await getAccessToken();
        let uid = user.id;

        try {
          const meRes = await fetch("/api/user/me", {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            uid = meData.userId;
            setVerifiedUserId(uid);
          }
        } catch {}

        const [supabaseVideos] = await Promise.all([
          getVideosByCreator(uid),
          checkLiveStatus(uid),
        ]);

        const transformedVideos = await transformVideosWithCreators(supabaseVideos);
        setVideos(transformedVideos);

        const totalViews = supabaseVideos.reduce((s: number, v: SupabaseVideo) => s + (v.views || 0), 0);
        const totalLikes = supabaseVideos.reduce((s: number, v: SupabaseVideo) => s + (v.likes || 0), 0);

        let totalFollowers = 0;
        try {
          const creator = await getCreatorByDID(uid);
          totalFollowers = creator?.follower_count || 0;
        } catch {}

        setStats({ totalViews, totalLikes, totalFollowers });

        if (canStream) {
          try {
            const recRes = await fetch("/api/stream/recordings", {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              setRecordings(recData.recordings || []);
            }
          } catch {}
        }
      } catch {
        // keep zeros
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
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
    setDeleting(videoId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch("/api/video/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error("Failed to delete video");
      setVideos(videos.filter(v => v.id !== videoId));
      toast.success("Video deleted successfully");
    } catch {
      toast.error("Failed to delete video");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (!confirm("Are you sure you want to delete this recording? This action cannot be undone.")) return;
    setDeletingRecording(recordingId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch(`/api/stream/recordings?id=${recordingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Failed to delete recording");
      setRecordings(recordings.filter(r => r.id !== recordingId));
      toast.success("Recording deleted successfully");
    } catch {
      toast.error("Failed to delete recording");
    } finally {
      setDeletingRecording(null);
    }
  };

  const handleDownloadRecording = (downloadUrl: string, title: string) => {
    if (!downloadUrl) { toast.error("Download URL not available"); return; }
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
          <LoadingShimmer className="h-48 mb-8" />
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
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="relative">
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        {/* ─── Livestream Studio ─── */}
        {canStream && (
          <div className="rounded-3xl border-2 overflow-hidden">
            {/* LIVE state — actively streaming in this session */}
            {liveStatus === "live" && activeStream && (
              <div className="bg-gradient-to-br from-red-950/60 via-[#18122D] to-[#1a0b2e] border-red-500/60 p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/50">
                        <FiRadio className="w-7 h-7 text-white" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-ping" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-black rounded tracking-widest">● LIVE</span>
                        {detectedStream?.startedAt && (
                          <span className="text-gray-400 text-xs">{formatElapsed(detectedStream.startedAt)} elapsed</span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-white">{activeStream.title}</h2>
                      <p className="text-gray-400 text-sm flex items-center gap-1.5 mt-1">
                        <FiWifi className="w-3.5 h-3.5 text-green-400" />
                        Broadcasting now — your audience can see you
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowStreamModal(true)}
                      className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full transition flex items-center gap-2 shadow-lg shadow-red-500/30"
                    >
                      <FiRadio className="w-4 h-4" />
                      Return to Stream
                    </button>
                    <button
                      onClick={handleClearAll}
                      disabled={isClearing}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <FiXCircle className="w-4 h-4" />
                      {isClearing ? "Ending..." : "End Stream"}
                    </button>
                  </div>
                </div>

                {/* Quick info row */}
                <div className="mt-6 pt-5 border-t border-red-500/20 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-red-500/10 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Method</p>
                    <p className="text-white font-semibold">{activeStream.method === "browser" ? "Browser (WebRTC)" : "OBS / Streamlabs"}</p>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Status</p>
                    <p className="text-green-400 font-semibold flex items-center gap-1">
                      <FiCheckCircle className="w-3.5 h-3.5" /> Connected
                    </p>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-3 col-span-2 md:col-span-1">
                    <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Share Link</p>
                    <button
                      onClick={() => {
                        const handle = verifiedUserId;
                        navigator.clipboard.writeText(`${window.location.origin}/u/${handle}`);
                        toast.success("Profile link copied!");
                      }}
                      className="text-[#EB83EA] hover:text-white text-sm font-semibold flex items-center gap-1 transition"
                    >
                      <FiCopy className="w-3 h-3" /> Copy profile link
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STUCK state — Livepeer/DB says active but not in current session */}
            {liveStatus === "stuck" && detectedStream && (
              <div className="bg-gradient-to-br from-orange-950/40 via-[#18122D] to-[#1a0b2e] border-orange-500/40 p-6 md:p-8">
                {/* Top: clear explanation first */}
                <div className="flex items-start gap-3 mb-5 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                  <FiAlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-200/90 leading-relaxed">
                    Your previous stream <span className="font-bold text-white">&quot;{detectedStream.title}&quot;</span> didn&apos;t end cleanly.
                    The broadcast is still registered as active.{" "}
                    <span className="text-orange-300 font-semibold">Click &quot;Clear &amp; Start Fresh&quot; below to reset it</span> — you can then go live normally.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className="flex-1 sm:flex-none px-8 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-60 text-white font-bold rounded-full transition-all shadow-lg shadow-[#EB83EA]/30 hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2 text-base"
                  >
                    {isClearing ? (
                      <>
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                        Clearing…
                      </>
                    ) : (
                      <>
                        <FiXCircle className="w-4 h-4" />
                        Clear &amp; Start Fresh
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowStreamModal(true)}
                    className="flex-1 sm:flex-none px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition flex items-center justify-center gap-2"
                  >
                    <FiRadio className="w-4 h-4" />
                    Open Stream Manager
                  </button>
                </div>
              </div>
            )}

            {/* NONE state — no active streams */}
            {(liveStatus === "none" || liveStatus === "checking") && (
              <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] border-[#EB83EA]/10 p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 border-2 border-[#EB83EA]/20 flex items-center justify-center flex-shrink-0">
                      {liveStatus === "checking" ? (
                        <FiRefreshCw className="w-6 h-6 text-[#EB83EA] animate-spin" />
                      ) : (
                        <FiRadio className="w-7 h-7 text-[#EB83EA]" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {liveStatus === "checking" ? "Checking stream status…" : "Ready to Go Live"}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                        {liveStatus === "checking"
                          ? "Connecting to Livepeer…"
                          : "No active stream. Start broadcasting with browser or OBS/Streamlabs."}
                      </p>
                    </div>
                  </div>

                  {liveStatus === "none" && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowStreamModal(true)}
                        className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-full transition-all shadow-lg shadow-red-500/30 hover:shadow-xl hover:scale-[1.02] flex items-center gap-2"
                      >
                        <FiRadio className="w-5 h-5" />
                        Go Live
                      </button>
                    </div>
                  )}
                </div>

                {liveStatus === "none" && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {[
                      { icon: "🌐", title: "Browser Stream", desc: "No software needed — stream from your camera or screen directly in Dragverse." },
                      { icon: "🎬", title: "OBS / Streamlabs", desc: "Professional setup with scenes, overlays, and multi-source mixing." },
                      { icon: "📅", title: "Schedule Ahead", desc: "Set a future date and let your audience know when to tune in." },
                    ].map((item) => (
                      <div key={item.title} className="bg-[#2f2942]/40 rounded-2xl p-4 border border-[#EB83EA]/10">
                        <span className="text-2xl mb-2 block">{item.icon}</span>
                        <h3 className="font-bold text-white mb-1">{item.title}</h3>
                        <p className="text-gray-500 text-xs">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Video Management Section */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 md:p-8 border-2 border-[#EB83EA]/10 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold uppercase tracking-wide mb-2">Your Performances</h2>
              <p className="text-gray-400">All your fabulous content in one place</p>
            </div>
            <ActionButton
              onClick={() => router.push("/upload")}
              icon={<FiVideo className="w-5 h-5" />}
              size="lg"
            >
              Upload New
            </ActionButton>
          </div>

          <div className="space-y-4">
            {videos.length === 0 ? (
              <EmptyState
                icon="🎬"
                title="No Looks Yet"
                description="Ready for your close-up? Upload your first video and start building your empire!"
                actionLabel="Upload Your First Look"
                onAction={() => router.push("/upload")}
              />
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-5 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all hover:shadow-lg hover:shadow-[#EB83EA]/10 group"
                >
                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#EB83EA]/20 group-hover:border-[#EB83EA]/40 transition-all">
                      <Image
                        src={video.thumbnail && video.thumbnail.trim() !== "" ? video.thumbnail : "/default-thumbnail.jpg"}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 px-3 py-1 bg-[#EB83EA] text-white text-xs font-bold rounded-full shadow-lg">
                        {video.contentType === "short"
                          ? "SNAPSHOT"
                          : video.contentType === "podcast" || video.contentType === "music"
                          ? "AUDIO"
                          : "VIDEO"}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl mb-3 text-white group-hover:text-[#EB83EA] transition-colors">
                        {video.title}
                      </h3>
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => copyShareLink(video.id)}
                          className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                        >
                          <FiCopy className="w-4 h-4" />
                          {copiedId === video.id ? "✓ Copied!" : "Share"}
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
                          {deleting === video.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stream Recordings */}
        {canStream && recordings.length > 0 && (
          <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 md:p-8 border-2 border-[#EB83EA]/10 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold uppercase tracking-wide mb-2 flex items-center gap-2">
                  <FiRadio className="w-6 h-6 text-red-500" />
                  Stream Recordings
                </h2>
                <p className="text-gray-400">Manage your recorded livestreams</p>
              </div>
            </div>

            <div className="space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-5 border-2 border-red-500/10 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/10 group"
                >
                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden flex-shrink-0 border-2 border-red-500/20 group-hover:border-red-500/40 transition-all">
                      <Image
                        src={recording.thumbnail || "/default-thumbnail.jpg"}
                        alt={recording.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                        <FiRadio className="w-3 h-3" />
                        {recording.status === "ready" ? "RECORDED" : recording.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl mb-3 text-white group-hover:text-red-400 transition-colors">
                        {recording.title}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FiEye className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-semibold">{(recording.views || 0).toLocaleString()}</span>
                          <span className="text-xs">views</span>
                        </span>
                        <span className="text-gray-400 text-xs self-center">
                          Recorded {new Date(recording.recorded_at).toLocaleDateString()}
                        </span>
                        {recording.duration_seconds && (
                          <span className="text-gray-400 text-xs self-center">
                            {Math.floor(recording.duration_seconds / 60)}m
                          </span>
                        )}
                        {recording.is_published && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full flex items-center gap-1">
                            <FiUpload className="w-3 h-3" /> Published
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recording.download_url && recording.status === "ready" && (
                          <button
                            onClick={() => handleDownloadRecording(recording.download_url!, recording.title)}
                            className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                          >
                            <FiDownload className="w-4 h-4" /> Download
                          </button>
                        )}
                        {recording.playback_url && (
                          <button
                            onClick={() => window.open(recording.playback_url, "_blank")}
                            className="px-4 py-2 bg-[#2f2942] hover:bg-[#EB83EA]/20 border border-[#EB83EA]/20 hover:border-[#EB83EA]/40 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-white hover:text-[#EB83EA]"
                          >
                            <FiEye className="w-4 h-4" /> Watch
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecording(recording.id)}
                          disabled={deletingRecording === recording.id}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiTrash2 className="w-4 h-4" />
                          {deletingRecording === recording.id ? "Deleting…" : "Delete"}
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

      {/* Stream Modal */}
      {showStreamModal && canStream && (
        <StreamModal
          onClose={() => {
            setShowStreamModal(false);
            // Refresh live status after modal closes
            if (verifiedUserId) checkLiveStatus(verifiedUserId);
          }}
        />
      )}
    </div>
  );
}
