"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FiArrowLeft } from "react-icons/fi";
import { BlueskyBadge } from "@/components/profile/bluesky-badge";
import { SocialLinks } from "@/components/profile/social-links";
import { ProfileActionButtons } from "@/components/profile/profile-action-buttons";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { getCreatorByHandle } from "@/lib/supabase/creators";
import { transformSupabaseCreator } from "@/lib/supabase/transformers";
import { useBlueskyProfileByHandle } from "@/lib/bluesky/hooks";
import { Creator } from "@/types";

/**
 * Linkify text by converting URLs to clickable links
 */
function linkifyText(text: string) {
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  const parts = text.split(urlPattern).filter(Boolean);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.match(/^https?:\/\//)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#EB83EA] hover:text-[#E748E6] underline transition"
        >
          {part}
        </a>
      );
    } else if (part.match(/^www\./)) {
      return (
        <a
          key={index}
          href={`https://${part}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#EB83EA] hover:text-[#E748E6] underline transition"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

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
  const [activeTab, setActiveTab] = useState<"feed" | "looks" | "profile">("feed");
  const [currentUserDID, setCurrentUserDID] = useState<string | undefined>();

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
          setCreator(transformSupabaseCreator(ceramicProfile));
          setProfileType("dragverse");

          // If Dragverse user has Bluesky connected, fetch their Bluesky content too
          if (ceramicProfile.bluesky_handle) {
            fetchBlueskyContent();
          }
          return;
        }
      } catch (error) {
        console.log("Not found in Supabase, checking Bluesky");
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
              banner: blueskyProfile.banner || undefined,
              description: blueskyProfile.description || "",
              followerCount: blueskyProfile.followersCount,
              followingCount: blueskyProfile.followsCount,
              blueskyFollowerCount: blueskyProfile.followersCount,
              blueskyHandle: blueskyProfile.handle,
              blueskyDID: blueskyProfile.did,
              createdAt: new Date(),
              verified: false,
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

  // Render profile (Dragverse or Bluesky) - Twitch-style layout
  return (
    <div className="min-h-screen">
      {/* Back Button - Fixed top left */}
      <button
        onClick={() => router.back()}
        className="fixed top-20 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full transition shadow-lg"
      >
        <FiArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Hero Banner - Full width, large and prominent like Twitch */}
      <div className="relative w-full h-[40vh] md:h-[50vh] lg:h-[60vh] bg-gradient-to-br from-[#EB83EA]/20 via-[#7c3aed]/20 to-[#1a0b2e]">
        {creator.banner ? (
          <Image
            src={creator.banner}
            alt="Profile banner"
            fill
            className="object-cover"
            priority
          />
        ) : (
          // Default gradient banner if no custom banner
          <div className="absolute inset-0 bg-gradient-to-br from-[#EB83EA] via-[#7c3aed] to-[#1a0b2e]">
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0f071a]" />

        {/* Profile content overlaying banner - Twitch style */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
              {/* Avatar - Large and prominent */}
              <div className="relative w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-2xl border-4 border-[#0f071a] overflow-hidden bg-[#2f2942] shadow-2xl flex-shrink-0">
                <Image
                  src={creator.avatar}
                  alt={creator.displayName}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              {/* Name, handle, and actions */}
              <div className="flex-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-2">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-2xl">
                      {creator.displayName}
                    </h1>
                    {creator.verified && <VerificationBadge type="human" size={24} />}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-white/90 text-lg md:text-xl drop-shadow-lg">@{creator.handle}</p>
                    {creator.blueskyHandle && (
                      <BlueskyBadge handle={creator.blueskyHandle} />
                    )}
                  </div>
                  {/* Stats inline */}
                  <div className="flex gap-6 text-sm md:text-base">
                    <div className="group relative cursor-help">
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {creator.followerCount >= 1000
                          ? `${(creator.followerCount / 1000).toFixed(1)}K`
                          : creator.followerCount}
                      </span>
                      <span className="text-white/80 ml-2">Community</span>
                      {(creator.dragverseFollowerCount || creator.blueskyFollowerCount) && (
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-[#2f2942] text-xs text-white px-3 py-2 rounded-lg whitespace-nowrap border border-[#EB83EA]/30 z-10 shadow-xl">
                          {creator.dragverseFollowerCount ? `${creator.dragverseFollowerCount} on Dragverse` : ""}
                          {creator.dragverseFollowerCount && creator.blueskyFollowerCount ? " + " : ""}
                          {creator.blueskyFollowerCount ? `${creator.blueskyFollowerCount} on Bluesky` : ""}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-xl text-white drop-shadow-lg">
                        {creator.followingCount >= 1000
                          ? `${(creator.followingCount / 1000).toFixed(1)}K`
                          : creator.followingCount}
                      </span>
                      <span className="text-white/80 ml-2">Connections</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex-shrink-0">
                  <ProfileActionButtons
                    creator={creator}
                    isOwnProfile={false}
                    isDragverseUser={profileType === "dragverse"}
                    currentUserDID={currentUserDID}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area with cleaner spacing */}
      <div className="container mx-auto max-w-screen-xl px-4 md:px-8 py-8">
        {/* Bio/Description */}
        {creator.description && (
          <div className="mb-8 max-w-3xl">
            <p className="text-[#FCF1FC] text-lg leading-relaxed">
              {linkifyText(creator.description)}
            </p>
          </div>
        )}

        {/* Tabs - Twitch-style */}
        <div className="border-b-2 border-[#2f2942] mb-8">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-6 py-3 font-bold text-base transition-all relative ${
                activeTab === "feed"
                  ? "text-white bg-[#2f2942]"
                  : "text-gray-400 hover:text-white hover:bg-[#2f2942]/50"
              }`}
            >
              Feed
              {activeTab === "feed" && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#EB83EA]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("looks")}
              className={`px-6 py-3 font-bold text-base transition-all relative ${
                activeTab === "looks"
                  ? "text-white bg-[#2f2942]"
                  : "text-gray-400 hover:text-white hover:bg-[#2f2942]/50"
              }`}
            >
              Looks
              {activeTab === "looks" && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#EB83EA]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-6 py-3 font-bold text-base transition-all relative ${
                activeTab === "profile"
                  ? "text-white bg-[#2f2942]"
                  : "text-gray-400 hover:text-white hover:bg-[#2f2942]/50"
              }`}
            >
              About
              {activeTab === "profile" && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#EB83EA]" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="pb-12">
          {activeTab === "feed" && (
            <div className="space-y-4 max-w-4xl">
              {blueskyPosts.length > 0 ? (
                blueskyPosts.map((post: any) => (
                  <a
                    key={post.id}
                    href={post.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-6 bg-[#18122D] rounded-xl border-2 border-[#2f2942] hover:border-[#EB83EA] transition-all hover:shadow-lg hover:shadow-[#EB83EA]/20"
                  >
                    <p className="text-[#FCF1FC] text-base mb-3 leading-relaxed">{post.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.likes > 0 && (
                        <span className="flex items-center gap-1">
                          <FiHeart className="w-4 h-4 text-red-400" />
                          {post.likes}
                        </span>
                      )}
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-center py-20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2f2942] flex items-center justify-center">
                    <span className="text-3xl">📝</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No posts yet</h3>
                  <p className="text-gray-400">When {creator.displayName} posts, they'll show up here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "looks" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {blueskyPhotos.length > 0 ? (
                blueskyPhotos.map((photo: any) => (
                  <a
                    key={photo.id}
                    href={photo.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer border-2 border-transparent hover:border-[#EB83EA] transition-all"
                  >
                    <Image
                      src={photo.thumbnail}
                      alt={photo.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white text-sm font-medium line-clamp-2">{photo.title}</p>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="col-span-full text-center py-20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2f2942] flex items-center justify-center">
                    <span className="text-3xl">📸</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No looks yet</h3>
                  <p className="text-gray-400">Photos and looks will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-[#18122D] rounded-2xl p-8 border-2 border-[#2f2942]">
                <h3 className="text-2xl font-bold text-[#FCF1FC] mb-6">About {creator.displayName}</h3>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  {creator.description || "No bio available"}
                </p>

                {profileType === "bluesky" && (
                  <div className="pt-6 border-t border-[#2f2942]">
                    <h4 className="text-lg font-semibold text-[#FCF1FC] mb-4">Connect</h4>
                    <SocialLinks creator={creator} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
