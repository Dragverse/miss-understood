"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FiUpload,
  FiLogOut,
  FiMenu,
  FiX,
  FiVideo,
  FiUser,
  FiBell,
  FiPlus,
  FiMessageSquare,
  FiHeadphones,
  FiInfo,
  FiGlobe,
  FiHeart,
  FiSettings,
} from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/lib/store/auth";
import { useCanLivestream } from "@/lib/livestream";
import { useAuthUser } from "@/lib/privy/hooks";
import { SearchDropdown } from "./search-dropdown";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { getSafeAvatar } from "@/lib/utils/thumbnail-helpers";

export function Navbar() {
  const { login, logout, authenticated, user, getAccessToken } = usePrivy();
  const { setSession, setCreator, clearAuth, creator } = useAuth();
  const { canStream } = useCanLivestream();
  const { blueskyProfile, blueskyConnected, farcasterHandle } = useAuthUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Get wallet address and fetch USDC balance
  const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
  const walletAddress = wallet && 'address' in wallet ? wallet.address as `0x${string}` : undefined;

  // USDC contract on Base network
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
  const USDC_ABI = [
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    },
  ] as const;

  // Fetch USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    chainId: 8453, // Base network
  });

  // User has social connection (for create button)
  const hasConnection = blueskyConnected || !!farcasterHandle;

  // Fetch notifications count
  useEffect(() => {
    async function fetchNotifications() {
      if (!authenticated) return;

      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch("/api/notifications", { headers });
        if (!response.ok) return; // Silently skip auth failures
        const data = await response.json();

        if (data.success) {
          setNotificationCount(data.unreadCount || 0);
        }
      } catch (error) {
        // Silently ignore — notifications are non-critical
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [authenticated, getAccessToken]);

  // Close create menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showCreateMenu && !target.closest('.create-menu-container')) {
        setShowCreateMenu(false);
      }
    };

    if (showCreateMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCreateMenu]);

  const handleLogin = () => {
    login();
  };

  const handleLogout = () => {
    logout();
    clearAuth();
  };

  // Sync Privy auth with our store + fetch creator profile (avatar)
  React.useEffect(() => {
    if (authenticated && user) {
      setSession({
        did: user.id,
        handle:
          user.email?.address ||
          user.google?.email ||
          user.farcaster?.username ||
          "user",
        accessJwt: "",
        refreshJwt: "",
      });

      // Fetch creator profile from Supabase to populate avatar in nav
      (async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch("/api/user/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.success && data.creator) {
            setCreator({
              did: data.creator.did,
              handle: data.creator.handle,
              displayName: data.creator.display_name,
              avatar: data.creator.avatar || "",
              banner: data.creator.banner || "",
              description: data.creator.description || "",
              followerCount: data.creator.follower_count || 0,
              followingCount: data.creator.following_count || 0,
              createdAt: new Date(data.creator.created_at),
              verified: data.creator.verified || false,
              walletAddress: data.creator.wallet_address,
              tipCount: data.creator.tip_count || 0,
            });
          }
        } catch {
          // Non-critical — avatar will fall back to Bluesky/Twitter/default
        }
      })();
    }
  }, [authenticated, user, setSession, setCreator, getAccessToken]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a0b2e] border-b border-white/10 h-16">
      <div className="h-full px-6 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <Image
            src="/logo.svg"
            alt="Dragverse"
            width={140}
            height={56}
            className="h-12 w-auto"
            priority
          />
        </Link>

        {/* Search Bar - Desktop */}
        <div className="hidden md:block flex-1 max-w-xl">
          <SearchDropdown />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {authenticated ? (
            <>
              {/* Create Button - Show for all authenticated users */}
              <div className="relative hidden md:block create-menu-container">
                <button
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="w-10 h-10 rounded-full bg-[#EB83EA] hover:bg-[#E748E6] flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                  title="Create Content"
                >
                  <FiPlus className="w-5 h-5 text-white" />
                </button>
                {/* Create Dropdown */}
                {showCreateMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-xl p-2 z-50">
                    {canStream && (
                      <Link
                        href="/dashboard"
                        onClick={() => setShowCreateMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <FiVideo className="w-4 h-4" />
                        Go Live
                      </Link>
                    )}
                    <Link
                      href="/upload"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <FiVideo className="w-4 h-4" />
                      Upload Video
                    </Link>
                    <Link
                      href="/upload?type=audio"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <FiHeadphones className="w-4 h-4" />
                      Upload Audio
                    </Link>
                    {/* Create Post - Only show if user has social connections */}
                    {hasConnection && (
                      <Link
                        href="/feed/create"
                        onClick={() => setShowCreateMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                        Create Post
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Notifications */}
              <Link
                href="/notifications"
                className="relative w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-all hidden md:flex"
                title="Notifications"
              >
                <FiBell className="w-5 h-5 text-gray-300" />
                {notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#EB83EA] rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  </div>
                )}
              </Link>

              {/* User Avatar with Dropdown */}
              <div className="relative group hidden md:block">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#EB83EA] cursor-pointer hover:scale-105 transition-transform">
                  <Image
                    alt="User Profile"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    src={getSafeAvatar(
                      creator?.avatar || blueskyProfile?.avatar || user?.twitter?.profilePictureUrl,
                      "/defaultpfp.png"
                    )}
                  />
                </div>
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
                  {user && walletAddress && usdcBalance && parseFloat(formatUnits(usdcBalance as bigint, 6)) > 0 ? (
                    <>
                      <div className="px-4 py-3 bg-white/5 rounded-xl mb-2">
                        <div className="text-xs text-gray-400 mb-1">Wallet Balance</div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">👛</span>
                          <div className="text-lg font-bold text-white">
                            ${parseFloat(formatUnits(usdcBalance as bigint, 6)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                    </>
                  ) : null}
                  <Link
                    href="/dashboard"
                    className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/profile/following"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <FiHeart className="w-4 h-4" />
                    Following
                  </Link>
                  {canStream && (
                    <Link
                      href="/live"
                      className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                    >
                      Go Live
                    </Link>
                  )}
                  <div className="my-1 h-px bg-white/10" />
                  <Link
                    href="/about"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <FiInfo className="w-4 h-4" />
                    About
                  </Link>
                  <Link
                    href="/tech-ethics"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <FiGlobe className="w-4 h-4" />
                    Tech & Ethics
                  </Link>
                  <Link
                    href="/settings"
                    className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="px-5 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold text-sm transition"
            >
              Sign In
            </button>
          )}

          {/* Mobile Menu Toggle - Avatar + hamburger */}
          {authenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center gap-2 p-1 text-white"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#EB83EA] flex-shrink-0">
                <Image
                  src={getSafeAvatar(
                    creator?.avatar || blueskyProfile?.avatar || user?.twitter?.profilePictureUrl,
                    "/defaultpfp.png"
                  )}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              {mobileMenuOpen ? (
                <FiX className="text-xl" />
              ) : (
                <FiMenu className="text-xl" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu - Account Actions Only */}
      {mobileMenuOpen && authenticated && (
        <div className="md:hidden bg-[#1a0b2e] border-t border-white/10">
          <div className="flex flex-col p-4 space-y-2">
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#EB83EA] flex-shrink-0">
                <Image
                  src={getSafeAvatar(
                    creator?.avatar || blueskyProfile?.avatar || user?.twitter?.profilePictureUrl,
                    "/defaultpfp.png"
                  )}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              My Profile
            </Link>
            <Link
              href="/upload"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition"
            >
              <FiUpload className="w-5 h-5" /> Upload Video
            </Link>
            <Link
              href="/live"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition"
            >
              <FiVideo className="w-5 h-5" /> Go Live
            </Link>
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition"
            >
              <FiSettings className="w-5 h-5" /> Settings
            </Link>
            <div className="my-1 h-px bg-white/10" />
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition text-red-400"
            >
              <FiLogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
