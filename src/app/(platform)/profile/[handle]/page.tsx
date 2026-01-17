"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FiArrowLeft } from "react-icons/fi";
import { BlueskyBadge } from "@/components/profile/bluesky-badge";
import { SocialLinks } from "@/components/profile/social-links";
import { getCreatorByHandle } from "@/lib/ceramic/creators";
import { useBlueskyProfileByHandle } from "@/lib/bluesky/hooks";
import { Creator } from "@/types";

/**
 * Dynamic Profile Page
 * Handles both Dragverse users and external Bluesky accounts
 * Route: /profile/[handle]
 */
export default function DynamicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;

  const [profileType, setProfileType] = useState<"loading" | "dragverse" | "bluesky" | "not-found">("loading");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "photos" | "about">("posts");

  // Try to fetch Bluesky profile if it looks like a Bluesky handle
  const isBlueskyHandle = handle.includes(".bsky.social") || handle.includes(".");
  const { profile: blueskyProfile, isLoading: blueskyLoading, error: blueskyError } = useBlueskyProfileByHandle(
    isBlueskyHandle ? handle : null
  );

  const [blueskyPosts, setBlueskyPosts] = useState<any[]>([]);
  const [blueskyPhotos, setBlueskyPhotos] = useState<any[]>([]);

  // Determine profile type and load data
  useEffect(() => {
    async function loadProfile() {
      // First, try to find in Ceramic (Dragverse user)
      try {
        const ceramicProfile = await getCreatorByHandle(handle);
        if (ceramicProfile) {
          setCreator(ceramicProfile as Creator);
          setProfileType("dragverse");
          return;
        }
      } catch (error) {
        console.log("Not found in Ceramic, checking Bluesky");
      }

      // If not in Ceramic and looks like Bluesky handle, wait for Bluesky fetch
      if (isBlueskyHandle) {
        if (!blueskyLoading) {
          if (blueskyProfile) {
            // Convert Bluesky profile to Creator format
            setCreator({
              did: blueskyProfile.did,
              handle: blueskyProfile.handle,
              displayName: blueskyProfile.displayName,
              avatar: blueskyProfile.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${blueskyProfile.handle}`,
              banner: blueskyProfile.banner,
              description: blueskyProfile.description || "",
              followerCount: blueskyProfile.followersCount,
              followingCount: blueskyProfile.followsCount,
              createdAt: new Date(),
              verified: false,
              profileSource: "bluesky",
            });
            setProfileType("bluesky");

            // Fetch Bluesky posts
            fetchBlueskyContent();
          } else if (blueskyError) {
            setProfileType("not-found");
          }
        }
      } else {
        // Not a Bluesky handle and not in Ceramic
        setProfileType("not-found");
      }
    }

    loadProfile();
  }, [handle, blueskyProfile, blueskyLoading, blueskyError, isBlueskyHandle]);

  // Fetch Bluesky posts and photos
  async function fetchBlueskyContent() {
    try {
      const response = await fetch(`/api/bluesky/feed?limit=50`);
      const data = await response.json();

      if (data.success && data.posts) {
        // Filter posts for this specific user
        const userPosts = data.posts.filter((post: any) =>
          post.creator?.handle === handle || post.author?.handle === handle
        );

        // Separate posts and photos
        const photos = userPosts.filter((post: any) => post.thumbnail);
        const textPosts = userPosts.filter((post: any) => !post.thumbnail);

        setBlueskyPhotos(photos);
        setBlueskyPosts(textPosts);
      }
    } catch (error) {
      console.error("Failed to fetch Bluesky content:", error);
    }
  }

  // Loading state
  if (profileType === "loading" || (isBlueskyHandle && blueskyLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  // Not found state
  if (profileType === "not-found" || !creator) {
    return (
      <div className="container mx-auto max-w-screen-xl px-4 py-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-[#FCF1FC] mb-4">Profile Not Found</h1>
          <p className="text-gray-400 mb-6">
            The profile @{handle} doesn't exist or is private.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Render profile (Dragverse or Bluesky)
  return (
    <div className="container mx-auto max-w-screen-xl px-4">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition my-4"
      >
        <FiArrowLeft className="w-5 h-5" />
        Back
      </button>

      {/* External Bluesky Profile Banner */}
      {profileType === "bluesky" && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-sm text-blue-400">
            <strong>External Bluesky Profile</strong> - This creator is on Bluesky. Follow them there!
          </p>
        </div>
      )}

      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 bg-gradient-to-r from-purple-900 to-pink-900 rounded-xl overflow-hidden mb-6">
        {creator.banner && (
          <Image
            src={creator.banner}
            alt="Profile banner"
            fill
            className="object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="relative -mt-16 md:-mt-20">
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#1a0b2e] overflow-hidden bg-[#2f2942]">
            <Image
              src={creator.avatar}
              alt={creator.displayName}
              fill
              className="object-cover"
            />
          </div>
        </div>

        <div className="flex-1 md:pt-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#FCF1FC] mb-1">
              {creator.displayName}
            </h1>
            <p className="text-[#EB83EA] text-base mb-2">@{creator.handle}</p>

            {profileType === "bluesky" && (
              <div className="mt-2">
                <BlueskyBadge handle={creator.handle} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description and Stats */}
      <div className="mb-8">
        <p className="text-[#FCF1FC] mb-4 max-w-3xl">
          {creator.description}
        </p>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-bold text-lg text-[#FCF1FC]">
              {(creator.followerCount / 1000).toFixed(1)}K
            </span>
            <span className="text-gray-400 ml-2">Followers</span>
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
      <div className="border-b border-gray-800 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("posts")}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === "posts"
                ? "text-[#EB83EA] border-b-2 border-[#EB83EA]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("photos")}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === "photos"
                ? "text-[#EB83EA] border-b-2 border-[#EB83EA]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Photos
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === "about"
                ? "text-[#EB83EA] border-b-2 border-[#EB83EA]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            About
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-12">
        {activeTab === "posts" && (
          <div className="space-y-4">
            {blueskyPosts.length > 0 ? (
              blueskyPosts.map((post: any) => (
                <a
                  key={post.id}
                  href={post.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-[#18122D] rounded-xl border border-[#2f2942] hover:border-[#EB83EA] transition"
                >
                  <p className="text-[#FCF1FC] mb-2">{post.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </a>
              ))
            ) : (
              <p className="text-gray-400 text-center py-12">No posts yet</p>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {blueskyPhotos.length > 0 ? (
              blueskyPhotos.map((photo: any) => (
                <a
                  key={photo.id}
                  href={photo.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square rounded-xl overflow-hidden hover:opacity-80 transition"
                >
                  <Image
                    src={photo.thumbnail}
                    alt={photo.title}
                    fill
                    className="object-cover"
                  />
                </a>
              ))
            ) : (
              <p className="text-gray-400 text-center py-12 col-span-full">No photos yet</p>
            )}
          </div>
        )}

        {activeTab === "about" && (
          <div className="max-w-2xl">
            <div className="bg-[#18122D] rounded-xl p-6 border border-[#2f2942]">
              <h3 className="text-lg font-semibold text-[#FCF1FC] mb-4">About</h3>
              <p className="text-gray-300 mb-6">{creator.description || "No bio available"}</p>

              {profileType === "bluesky" && (
                <div className="pt-4 border-t border-[#2f2942]">
                  <SocialLinks creator={creator} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
