"use client";

import { useAuthUser } from "@/lib/privy/hooks";
import { mockCreators, mockVideos } from "@/lib/utils/mock-data";
import Image from "next/image";
import { FiUser, FiEdit2, FiLink2, FiLogIn } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VideoCard } from "@/components/video/video-card";
import { SocialLinks } from "@/components/profile/social-links";
import { getCreatorByDID } from "@/lib/ceramic/creators";
import { Creator } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn, userHandle, userEmail, user, instagramHandle, tiktokHandle, farcasterHandle } = useAuthUser();
  const [activeTab, setActiveTab] = useState<"videos" | "about">("videos");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Fetch creator profile from Ceramic
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        // Try to load from Ceramic first
        const ceramicProfile = await getCreatorByDID(user.id);

        if (ceramicProfile) {
          // Use Ceramic profile data
          setCreator(ceramicProfile as Creator);
          setIsLoadingProfile(false);
          return;
        }
      } catch (error) {
        console.warn("Could not load from Ceramic, checking fallback:", error);
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

  // TODO: Replace with real video data from Ceramic when available
  // For now, show empty state since this is the user's real profile
  const creatorVideos: any[] = [];

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
                className="size-24 laptop:size-32 rounded-small border-2 border-white dark:bg-[#100c1f] bg-white shadow-2xl"
              />
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-[#FCF1FC]">
                    {creator.displayName}
                  </h1>
                  {creator.verified && (
                    <svg
                      className="w-5 h-5 text-[#EB83EA]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </div>
                <p className="text-[#EB83EA] text-base">@{userHandle}</p>
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
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {(creator.followerCount / 1000).toFixed(0)}K
              </span>
              <span className="text-gray-400 ml-2">Followers</span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {creatorVideos.length}
              </span>
              <span className="text-gray-400 ml-2">Videos</span>
            </div>
            <div>
              <span className="font-bold text-lg text-[#FCF1FC]">
                {(creator.followingCount / 1000).toFixed(1)}K
              </span>
              <span className="text-gray-400 ml-2">Following</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-[#2f2942] mb-8">
          <button
            onClick={() => setActiveTab("videos")}
            className={`pb-3 font-semibold transition ${
              activeTab === "videos"
                ? "border-b-2 border-[#EB83EA] text-[#FCF1FC]"
                : "text-gray-400 hover:text-[#FCF1FC]"
            }`}
          >
            Videos ({creatorVideos.length})
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-3 font-semibold transition ${
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
            {creatorVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {creatorVideos.map((video) => (
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
