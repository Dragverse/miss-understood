"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import Image from "next/image";
import { FiUser, FiEdit2, FiLogIn } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VideoCard } from "@/components/video/video-card";
import { SocialLinks } from "@/components/profile/social-links";
import { BlueskyBadge } from "@/components/profile/bluesky-badge";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { Creator, Video } from "@/types";
import { getLocalVideos } from "@/lib/utils/local-storage";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn, userHandle, userEmail, user, instagramHandle, tiktokHandle } = useAuthUser();
  const [activeTab, setActiveTab] = useState<"videos" | "bytes" | "audio" | "posts" | "photos" | "collections" | "about">("videos");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [blueskyProfile, setBlueskyProfile] = useState<any>(null);

  // Fetch creator profile from Ceramic
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        // Try to load from Ceramic first
        const ceramicProfile = await getCreatorByDID(user.id);

        if (ceramicProfile) {
          // Use Supabase profile data
          setCreator(transformSupabaseCreator(ceramicProfile));
          setIsLoadingProfile(false);
          return;
        }
      } catch (error) {
        console.warn("Could not load from Supabase, checking fallback:", error);
      }

      // Fallback: Load from localStorage if Ceramic unavailable
      const fallbackProfile = localStorage.getItem("dragverse_profile");
      if (fallbackProfile) {
        try {
          const profileData = JSON.parse(fallbackProfile);
          // Create temporary creator object
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
          console.log("Loaded profile from fallback storage");
          setIsLoadingProfile(false);
          return;
        } catch (e) {
          console.error("Failed to parse fallback profile:", e);
        }
      }

      // No Ceramic or fallback profile, use Privy data as initial state
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

  // Load user's uploaded videos from localStorage
  useEffect(() => {
    const localVideos = getLocalVideos();
    setUserVideos(localVideos);
  }, []);

  // Load Bluesky profile and content in parallel - FASTER!
  useEffect(() => {
    async function loadAllBlueskyData() {
      try {
        // Load session, profile, and feed in parallel for faster loading
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

        // Update Bluesky profile data immediately
        if (profileData.success && profileData.profile) {
          setBlueskyProfile(profileData.profile);

          // Update creator with Bluesky data
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

        // Update posts and photos if connected
        if (sessionData.connected && feedData.posts) {
          const userBlueskyPosts = feedData.posts.filter(
            (post: any) => post.creator.handle === sessionData.handle
          );

          // Separate photos and text posts
          const photos = userBlueskyPosts.filter(
            (post: any) => post.thumbnail && !post.playbackUrl?.includes("m3u8")
          );
          const textPosts = userBlueskyPosts.filter(
            (post: any) => !post.thumbnail
          );

          setUserPhotos(photos);
          setUserPosts(textPosts);
        }
      } catch (error) {
        console.error("Failed to load Bluesky data:", error);
      }
    }

    if (isAuthenticated) {
      loadAllBlueskyData();
    }
  }, [isAuthenticated]);

  // Show loading state while auth is initializing
  if (!isReady || (isAuthenticated && isLoadingProfile)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  // Show sign in prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="bg-[#18122D] rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[#2f2942] rounded-full flex items-center justify-center mx-auto mb-6">
            <FiUser className="w-10 h-10 text-[#EB83EA]" />
          </div>
          <h1 className="text-2xl font-bold text-[#FCF1FC] mb-3">
            Sign in to view your profile
          </h1>
          <p className="text-gray-400 mb-6">
            Create an account or sign in to access your profile, upload videos, and connect with the drag community.
          </p>
          <button
            onClick={() => signIn()}
            className="w-full px-6 py-3 bg-[#EB83EA] text-white rounded-lg font-medium hover:bg-[#E748E6] transition flex items-center justify-center gap-2"
          >
            <FiLogIn className="w-5 h-5" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Return early if no creator data loaded yet
  if (!creator) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  // Use videos from localStorage (uploaded by user)
  const creatorVideos = userVideos;

  return (
    <div>
      {/* Cover Section */}
      <div className="relative h-44 md:h-[20vw] ultrawide:h-[25vh] bg-[#EB83EA] bg-cover bg-center bg-no-repeat overflow-hidden">
        {creator.banner ? (
          <Image
            src={creator.banner}
            alt="banner"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <Image
            src={`https://api.dicebear.com/7.x/patterns/svg?seed=${userHandle}&backgroundColor=EB83EA`}
            alt="banner"
            fill
            className="object-cover"
            priority
          />
        )}
      </div>

      <div className="container mx-auto max-w-screen-xl px-2 xl:px-0">
        {/* Profile Header */}
        <div className="relative -mt-16 mb-6">
          <div className="flex flex-wrap justify-between items-end gap-4">
            {/* Avatar & Basic Info */}
            <div className="flex items-end gap-4">
              <Image
                src={creator.avatar}
                alt={creator.displayName}
                width={128}
                height={128}
                className="size-24 laptop:size-32 rounded-full border-4 border-white dark:bg-[#100c1f] bg-white shadow-2xl object-cover"
              />
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-[#FCF1FC]">
                    {creator.displayName}
                  </h1>
                  {creator.verified && (
                    <VerificationBadge type="creator" size={24} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[#EB83EA] text-base">@{creator.handle}</p>
                </div>
                {creator.blueskyHandle && (
                  <div className="mt-2">
                    <BlueskyBadge handle={creator.blueskyHandle} />
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Edit Profile for own profile */}
            <div className="flex gap-3 pb-2">
              <button
                onClick={() => router.push("/settings")}
                className="px-6 py-2 bg-[#EB83EA] text-white rounded-lg font-medium hover:bg-[#E748E6] transition flex items-center gap-2"
              >
                <FiEdit2 className="w-5 h-5" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Bio & Stats */}
        <div className="mb-6">
          <p className="text-[#FCF1FC] mb-4 max-w-3xl line-clamp-5">
            {creator.description}
          </p>
          <div className="flex gap-6 text-sm flex-wrap">
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {creator.followerCount.toLocaleString()}
              </span>
              <span className="text-gray-400 ml-2">
                Followers
                {creator.followerCount > 0 && blueskyProfile && (
                  <span className="text-xs text-blue-400 ml-1">(Bluesky)</span>
                )}
              </span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {creator.followingCount.toLocaleString()}
              </span>
              <span className="text-gray-400 ml-2">
                Following
                {creator.followingCount > 0 && blueskyProfile && (
                  <span className="text-xs text-blue-400 ml-1">(Bluesky)</span>
                )}
              </span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {creatorVideos.length}
              </span>
              <span className="text-gray-400 ml-2">Videos</span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {userPhotos.length}
              </span>
              <span className="text-gray-400 ml-2">Photos</span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {userPosts.length}
              </span>
              <span className="text-gray-400 ml-2">Posts</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-[#2f2942] mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("videos")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "videos"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Videos ({creatorVideos.filter(v => v.contentType !== 'short').length})
          </button>
          <button
            onClick={() => setActiveTab("bytes")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "bytes"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Bytes ({creatorVideos.filter(v => v.contentType === 'short').length})
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "audio"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Audio (0)
          </button>
          <button
            onClick={() => setActiveTab("posts")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "posts"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Posts ({userPosts.length})
          </button>
          <button
            onClick={() => setActiveTab("photos")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "photos"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Photos ({userPhotos.length})
          </button>
          <button
            onClick={() => setActiveTab("collections")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "collections"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Collections (0)
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-3 font-semibold transition whitespace-nowrap ${
              activeTab === "about"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            About
          </button>
        </div>

        {/* Content */}
        {activeTab === "videos" && (
          <div>
            {creatorVideos.filter(v => v.contentType !== 'short').length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {creatorVideos.filter(v => v.contentType !== 'short').map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#18122D] rounded-lg">
                <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">You haven&apos;t uploaded any videos yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "bytes" && (
          <div>
            {creatorVideos.filter(v => v.contentType === 'short').length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {creatorVideos.filter(v => v.contentType === 'short').map((video) => (
                  <Link key={video.id} href={`/shorts?v=${video.id}`} className="group">
                    <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#0f071a]">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white text-sm font-semibold line-clamp-2">{video.title}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#18122D] rounded-lg">
                <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">No bytes uploaded yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "audio" && (
          <div className="text-center py-12 bg-[#18122D] rounded-lg">
            <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-2">Audio feature coming soon</p>
            <p className="text-gray-500 text-sm">Upload songs and podcasts to share with your audience</p>
          </div>
        )}

        {activeTab === "collections" && (
          <div className="text-center py-12 bg-[#18122D] rounded-lg">
            <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-2">Collections feature coming soon</p>
            <p className="text-gray-500 text-sm">Create collections of your favorite content</p>
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
                    className="relative aspect-square rounded-lg overflow-hidden bg-[#0f071a] hover:opacity-90 transition"
                  >
                    <Image
                      src={photo.thumbnail}
                      alt={photo.description || "Photo"}
                      fill
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#18122D] rounded-lg">
                <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-3">
                  {creator.blueskyHandle
                    ? "No photos posted yet"
                    : "Connect Bluesky to share photos"}
                </p>
                {!creator.blueskyHandle && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold transition"
                  >
                    Connect Bluesky
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "posts" && (
          <div>
            {userPosts.length > 0 ? (
              <div className="max-w-2xl space-y-4">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#1a0b2e] border border-[#2f2942] rounded-xl p-6"
                  >
                    <p className="text-gray-200 mb-3 whitespace-pre-wrap">
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>
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
                          className="hover:text-[#EB83EA] transition"
                        >
                          View on Bluesky →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#18122D] rounded-lg">
                <FiUser className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-3">
                  {creator.blueskyHandle
                    ? "No text posts yet"
                    : "Connect Bluesky to share updates"}
                </p>
                {!creator.blueskyHandle && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold transition"
                  >
                    Connect Bluesky
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "about" && (
          <div className="max-w-2xl">
            <div className="bg-[#18122D] p-6 rounded-lg space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-[#FCF1FC]">Bio</h3>
                <p className="text-gray-400">{creator.description}</p>
              </div>
              <SocialLinks creator={creator} />
              <div className="border-t border-[#2f2942] pt-4">
                <h3 className="font-semibold mb-2 text-[#FCF1FC]">Joined</h3>
                <p className="text-gray-400">
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
  );
}
