"use client";

import { useState, useEffect } from "react";
import { FiMessageSquare, FiPlus } from "react-icons/fi";
import Link from "next/link";
import { useAuthUser } from "@/lib/privy/hooks";
import { isBlueskyConnected } from "@/lib/utils/bluesky-auth";
import { getLocalProfile } from "@/lib/utils/local-storage";
import { PostCard } from "@/components/feed/post-card";
import { Creator } from "@/types";

export default function FeedPage() {
  const { isAuthenticated } = useAuthUser();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<Creator> | null>(null);

  const hasBluesky = isBlueskyConnected(profile);

  useEffect(() => {
    const localProfile = getLocalProfile();
    setProfile(localProfile);
  }, []);

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      try {
        const response = await fetch("/api/bluesky/feed?limit=30");
        const data = await response.json();

        // Filter for text/photo posts only (exclude videos)
        // Videos have playbackUrl with .m3u8 or are from external video platforms
        const feedPosts = (data.posts || []).filter((post: any) => {
          const hasVideoPlayback = post.playbackUrl?.includes("m3u8");
          const hasExternalVideo =
            post.playbackUrl?.includes("youtube") ||
            post.playbackUrl?.includes("youtu.be") ||
            post.playbackUrl?.includes("vimeo") ||
            post.playbackUrl?.includes("tiktok");

          return !hasVideoPlayback && !hasExternalVideo;
        });

        setPosts(feedPosts);
      } catch (error) {
        console.error("Failed to load feed:", error);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiMessageSquare className="w-8 h-8 text-[#EB83EA]" />
          <h1 className="text-2xl font-bold">Community Feed</h1>
        </div>
        {hasBluesky && (
          <Link
            href="/feed/create"
            className="flex items-center gap-2 px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-full font-semibold transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Create Post
          </Link>
        )}
      </div>

      {/* Bluesky Connection Warning */}
      {isAuthenticated && !hasBluesky && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-300">
            <Link
              href="/settings"
              className="font-semibold underline hover:text-blue-200 transition"
            >
              Connect your Bluesky account
            </Link>{" "}
            in Settings to create posts and interact with the community.
          </p>
        </div>
      )}

      {/* Posts Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EB83EA]"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {posts.length === 0 && (
            <div className="text-center py-20">
              <FiMessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No posts yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Be the first to share something with the community!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
