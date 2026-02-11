"use client";

import { useState, useEffect } from "react";
import { SiBluesky, SiFarcaster } from "react-icons/si";
import Image from "next/image";

interface FollowerBreakdownProps {
  creatorDid: string;
  isOwnProfile?: boolean;
}

interface FollowerStats {
  total: number;
  bySource: {
    dragverse: number;
    bluesky: number;
    farcaster: number;
  };
}

export function FollowerBreakdown({
  creatorDid,
  isOwnProfile = false,
}: FollowerBreakdownProps) {
  const [stats, setStats] = useState<FollowerStats>({
    total: 0,
    bySource: { dragverse: 0, bluesky: 0, farcaster: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    loadStats();
  }, [creatorDid]);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/user/follower-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load follower stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncFarcasterFollowers = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/farcaster/followers/sync", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Synced ${data.count} Farcaster followers`);
        // Reload stats
        await loadStats();
      }
    } catch (error) {
      console.error("Failed to sync Farcaster followers:", error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading followers...</span>
      </div>
    );
  }

  const hasFollowers = stats.total > 0;
  const sources = [
    {
      name: "Dragverse",
      count: stats.bySource.dragverse,
      icon: <Image src="/logo.svg" alt="" width={16} height={16} />,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      name: "Bluesky",
      count: stats.bySource.bluesky,
      icon: <SiBluesky className="w-4 h-4" />,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      name: "Farcaster",
      count: stats.bySource.farcaster,
      icon: <SiFarcaster className="w-4 h-4" />,
      color: "text-purple-400",
      bgColor: "bg-purple-600/10",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Total Followers with Breakdown Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <span className="font-bold text-2xl">{stats.total}</span>
          <span className="text-gray-400 text-sm">
            Follower{stats.total !== 1 ? "s" : ""}
          </span>
          {hasFollowers && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                showBreakdown ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        {/* Sync Button (Own Profile Only) */}
        {isOwnProfile && (
          <button
            onClick={syncFarcasterFollowers}
            disabled={syncing}
            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            title="Sync Farcaster followers"
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <SiFarcaster className="w-3 h-3" />
                <span>Sync Farcaster</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Follower Breakdown */}
      {showBreakdown && hasFollowers && (
        <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">
            Followers by Platform
          </h4>

          {sources.map((source) => {
            if (source.count === 0) return null;

            const percentage = Math.round((source.count / stats.total) * 100);

            return (
              <div key={source.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`${source.bgColor} p-1.5 rounded-lg ${source.color}`}
                    >
                      {source.icon}
                    </div>
                    <span className="text-sm font-medium">{source.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{source.count}</span>
                    <span className="text-xs text-gray-500">
                      ({percentage}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full ${source.bgColor.replace("/10", "/50")} transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Followers State */}
      {!hasFollowers && showBreakdown && (
        <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
          <p className="text-gray-400 text-sm">No followers yet</p>
          {isOwnProfile && (
            <p className="text-gray-500 text-xs mt-2">
              Share your content to grow your audience across platforms!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
