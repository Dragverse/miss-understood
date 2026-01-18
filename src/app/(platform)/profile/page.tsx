"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import Image from "next/image";
import { FiUser, FiEdit2, FiLogIn, FiHeart, FiVideo, FiUsers, FiEye, FiStar, FiCalendar } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VideoCard } from "@/components/video/video-card";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { Creator, Video } from "@/types";
import { getLocalVideos } from "@/lib/utils/local-storage";
import { StatsCard, LoadingShimmer } from "@/components/shared";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn, userHandle, userEmail, user, instagramHandle, tiktokHandle } = useAuthUser();
  const [activeTab, setActiveTab] = useState<"videos" | "bytes" | "photos" | "posts" | "about">("videos");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [blueskyProfile, setBlueskyProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    videoCount: 0,
    photoCount: 0,
  });

  // Fetch creator profile
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        const ceramicProfile = await getCreatorByDID(user.id);
        if (ceramicProfile) {
          setCreator(transformSupabaseCreator(ceramicProfile));
          setIsLoadingProfile(false);
          return;
        }
      } catch (error) {
        console.warn("Could not load from Supabase:", error);
      }

      // Fallback to localStorage or Privy data
      const fallbackProfile = localStorage.getItem("dragverse_profile");
      if (fallbackProfile) {
        try {
          const profileData = JSON.parse(fallbackProfile);
          setCreator({
            did: user.id,
            id: `temp-${user.id}`,
            handle: profileData.handle || userHandle || user.id.slice(0, 8),
            displayName: profileData.displayName || "Unnamed Creator",
            description: profileData.description || "",
            avatar: profileData.avatar || user?.twitter?.profilePictureUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userHandle}&backgroundColor=EB83EA`,
            banner: profileData.banner,
            website: profileData.website,
            instagramHandle: profileData.instagramHandle || instagramHandle,
            tiktokHandle: profileData.tiktokHandle || tiktokHandle,
            followerCount: 0,
            followingCount: 0,
            createdAt: new Date(user.createdAt || Date.now()),
            verified: false,
          } as Creator);
          setIsLoadingProfile(false);
          return;
        } catch (e) {
          console.error("Failed to parse fallback profile:", e);
        }
      }

      // Use Privy data as initial state
      setCreator({
        did: user.id,
        handle: userHandle || userEmail?.split('@')[0] || "user",
        displayName: userHandle || userEmail?.split('@')[0] || "Drag Artist",
        avatar: user?.twitter?.profilePictureUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userHandle}&backgroundColor=EB83EA`,
        description: "Welcome to my Dragverse profile! 🎭✨",
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date(user.createdAt || Date.now()),
        verified: false,
        instagramHandle: instagramHandle || undefined,
        tiktokHandle: tiktokHandle || undefined,
      });
      setIsLoadingProfile(false);
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated, user?.id]);

  // Load videos
  useEffect(() => {
    const localVideos = getLocalVideos();
    setUserVideos(localVideos);

    // Calculate stats
    const totalViews = localVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = localVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    setStats(prev => ({
      ...prev,
      totalViews,
      totalLikes,
      videoCount: localVideos.length,
    }));
  }, []);

  // Load Bluesky data
  useEffect(() => {
    async function loadAllBlueskyData() {
      try {
        const [sessionResponse, profileResponse, feedResponse] = await Promise.all([
          fetch("/api/bluesky/session"),
          fetch("/api/bluesky/profile"),
          fetch("/api/bluesky/feed?limit=50")
        ]);

        const [sessionData, profileData, feedData] = await Promise.all([
          sessionResponse.json(),
          profileResponse.json(),
          feedResponse.json()
        ]);

        if (profileData.success && profileData.profile) {
          setBlueskyProfile(profileData.profile);
          setCreator((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              avatar: profileData.profile.avatar || prev.avatar,
              banner: profileData.profile.banner || prev.banner,
              description: profileData.profile.description || prev.description,
              followerCount: profileData.profile.followersCount || prev.followerCount,
              followingCount: profileData.profile.followsCount || prev.followingCount,
              blueskyHandle: profileData.profile.handle,
            };
          });
        }

        if (sessionData.connected && feedData.posts) {
          const userBlueskyPosts = feedData.posts.filter(
            (post: any) => post.creator.handle === sessionData.handle
          );

          const photos = userBlueskyPosts.filter(
            (post: any) => post.thumbnail && !post.playbackUrl?.includes("m3u8")
          );
          const textPosts = userBlueskyPosts.filter(
            (post: any) => !post.thumbnail
          );

          setUserPhotos(photos);
          setUserPosts(textPosts);
          setStats(prev => ({ ...prev, photoCount: photos.length }));
        }
      } catch (error) {
        console.error("Failed to load Bluesky data:", error);
      }
    }

    if (isAuthenticated) {
      loadAllBlueskyData();
    }
  }, [isAuthenticated]);

  if (!isReady || (isAuthenticated && isLoadingProfile)) {
    return (
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <LoadingShimmer className="h-16 w-96 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
            <LoadingShimmer aspectRatio="square" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#EB83EA]/30">
            <FiUser className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Sign in to view your profile</h1>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create an account or sign in to showcase your talent and connect with the drag community.
          </p>
          <button
            onClick={signIn}
            className="px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-full transition-all flex items-center gap-2 mx-auto"
          >
            <FiLogIn className="w-5 h-5" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  const videosList = userVideos.filter(v => v.contentType !== 'short');
  const bytesList = userVideos.filter(v => v.contentType === 'short');

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          {/* Banner */}
          <div className="relative h-48 lg:h-64 rounded-3xl overflow-hidden mb-6 border-2 border-[#EB83EA]/10">
            {creator.banner ? (
              <Image
                src={creator.banner}
                alt="banner"
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Avatar Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="relative w-28 h-28 lg:w-32 lg:h-32 rounded-3xl border-4 border-[#18122D] overflow-hidden shadow-2xl flex-shrink-0">
                  <Image
                    src={creator.avatar}
                    alt={creator.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl lg:text-4xl font-bold uppercase tracking-wide text-white">
                      {creator.displayName}
                    </h1>
                    {creator.verified && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#CDB531] flex items-center justify-center" title="Verified Creator">
                        <FiStar className="w-4 h-4 text-black font-bold" />
                      </div>
                    )}
                  </div>
                  <p className="text-[#EB83EA] text-lg font-semibold">@{creator.handle}</p>
                </div>
                <button
                  onClick={() => router.push("/settings")}
                  className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
                >
                  <FiEdit2 className="w-5 h-5" />
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Bio */}
          {creator.description && (
            <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/10 mb-6">
              <p className="text-gray-200 text-lg leading-relaxed">
                {creator.description}
              </p>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <StatsCard
            icon={<FiUsers className="w-6 h-6 text-white" />}
            label="Followers"
            value={creator.followerCount.toLocaleString()}
            gradient="from-purple-500/10 via-indigo-500/10 to-blue-500/10"
          />
          <StatsCard
            icon={<FiVideo className="w-6 h-6 text-white" />}
            label="Videos"
            value={stats.videoCount.toLocaleString()}
            gradient="from-green-500/10 via-emerald-500/10 to-teal-500/10"
          />
          <StatsCard
            icon={<FiEye className="w-6 h-6 text-white" />}
            label="Total Views"
            value={stats.totalViews.toLocaleString()}
            gradient="from-blue-500/10 via-purple-500/10 to-pink-500/10"
          />
          <StatsCard
            icon={<FiHeart className="w-6 h-6 text-white" />}
            label="Total Hearts"
            value={stats.totalLikes.toLocaleString()}
            gradient="from-pink-500/10 via-rose-500/10 to-red-500/10"
          />
        </div>

        {/* Content Section */}
        <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 md:p-8 border-2 border-[#EB83EA]/10 shadow-xl">
          {/* Tabs */}
          <div className="flex gap-4 border-b border-[#EB83EA]/20 mb-8 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab("videos")}
              className={`pb-4 px-4 font-bold transition whitespace-nowrap ${
                activeTab === "videos"
                  ? "border-b-2 border-[#EB83EA] text-[#EB83EA]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              VIDEOS ({videosList.length})
            </button>
            <button
              onClick={() => setActiveTab("bytes")}
              className={`pb-4 px-4 font-bold transition whitespace-nowrap ${
                activeTab === "bytes"
                  ? "border-b-2 border-[#EB83EA] text-[#EB83EA]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              BYTES ({bytesList.length})
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`pb-4 px-4 font-bold transition whitespace-nowrap ${
                activeTab === "photos"
                  ? "border-b-2 border-[#EB83EA] text-[#EB83EA]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              PHOTOS ({userPhotos.length})
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`pb-4 px-4 font-bold transition whitespace-nowrap ${
                activeTab === "posts"
                  ? "border-b-2 border-[#EB83EA] text-[#EB83EA]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              POSTS ({userPosts.length})
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`pb-4 px-4 font-bold transition whitespace-nowrap ${
                activeTab === "about"
                  ? "border-b-2 border-[#EB83EA] text-[#EB83EA]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ABOUT
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "videos" && (
            <div>
              {videosList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videosList.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiVideo className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Videos Yet</h3>
                  <p className="text-gray-400 mb-6">Start uploading your performances!</p>
                  <button
                    onClick={() => router.push("/upload")}
                    className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                  >
                    Upload Your First Video
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "bytes" && (
            <div>
              {bytesList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {bytesList.map((video) => (
                    <Link key={video.id} href={`/shorts?v=${video.id}`} className="group">
                      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#0f071a] border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all">
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-white text-sm font-bold line-clamp-2">{video.title}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiVideo className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Bytes Yet</h3>
                  <p className="text-gray-400">Upload short-form content to get started</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "photos" && (
            <div>
              {userPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {userPhotos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-[#0f071a] border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/30 transition-all"
                    >
                      <Image
                        src={photo.thumbnail}
                        alt={photo.description || "Photo"}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiStar className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {creator.blueskyHandle ? "No Photos Yet" : "Connect Bluesky"}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {creator.blueskyHandle
                      ? "Share your photos with the community"
                      : "Connect your Bluesky account to share photos"}
                  </p>
                  {!creator.blueskyHandle && (
                    <button
                      onClick={() => router.push("/settings")}
                      className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                    >
                      Connect Bluesky
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "posts" && (
            <div>
              {userPosts.length > 0 ? (
                <div className="max-w-3xl mx-auto space-y-4">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10 hover:border-[#EB83EA]/20 transition-all"
                    >
                      <p className="text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed">
                        {post.description}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span className="flex items-center gap-2">
                          <FiCalendar className="w-4 h-4" />
                          {new Date(post.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {post.externalUrl && (
                          <a
                            href={post.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#EB83EA] hover:text-[#E748E6] transition font-semibold"
                          >
                            View on Bluesky →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 flex items-center justify-center mx-auto mb-4">
                    <FiUser className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {creator.blueskyHandle ? "No Posts Yet" : "Connect Bluesky"}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {creator.blueskyHandle
                      ? "Share your thoughts with the community"
                      : "Connect your Bluesky account to share updates"}
                  </p>
                  {!creator.blueskyHandle && (
                    <button
                      onClick={() => router.push("/settings")}
                      className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6c2bd9] text-white font-bold rounded-xl transition-all"
                    >
                      Connect Bluesky
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-6">
                {/* Bio Section */}
                <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                  <h3 className="text-lg font-bold text-[#EB83EA] mb-3 uppercase tracking-wide">About</h3>
                  <p className="text-gray-200 leading-relaxed">
                    {creator.description || "No bio added yet"}
                  </p>
                </div>

                {/* Social Links */}
                {(creator.instagramHandle || creator.tiktokHandle || creator.website || creator.blueskyHandle) && (
                  <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                    <h3 className="text-lg font-bold text-[#EB83EA] mb-4 uppercase tracking-wide">Social Links</h3>
                    <div className="space-y-3">
                      {creator.instagramHandle && (
                        <a
                          href={`https://instagram.com/${creator.instagramHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Instagram:</span>
                          <span>@{creator.instagramHandle}</span>
                        </a>
                      )}
                      {creator.tiktokHandle && (
                        <a
                          href={`https://tiktok.com/@${creator.tiktokHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">TikTok:</span>
                          <span>@{creator.tiktokHandle}</span>
                        </a>
                      )}
                      {creator.blueskyHandle && (
                        <a
                          href={`https://bsky.app/profile/${creator.blueskyHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Bluesky:</span>
                          <span>@{creator.blueskyHandle}</span>
                        </a>
                      )}
                      {creator.website && (
                        <a
                          href={creator.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-gray-300 hover:text-[#EB83EA] transition"
                        >
                          <span className="font-semibold">Website:</span>
                          <span>{creator.website}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Join Date */}
                <div className="bg-gradient-to-br from-[#2f2942]/40 to-[#1a0b2e]/40 rounded-2xl p-6 border-2 border-[#EB83EA]/10">
                  <h3 className="text-lg font-bold text-[#EB83EA] mb-3 uppercase tracking-wide">Member Since</h3>
                  <p className="text-gray-200 flex items-center gap-2">
                    <FiCalendar className="w-5 h-5" />
                    {creator.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
