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
} from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/lib/store/auth";
import { useCanLivestream } from "@/lib/livestream";
import { useAuthUser } from "@/lib/privy/hooks";
import { SearchDropdown } from "./search-dropdown";
import { useBalance } from "wagmi";

export function Navbar() {
  const { login, logout, authenticated, user } = usePrivy();
  const { setSession, clearAuth } = useAuth();
  const { canStream } = useCanLivestream();
  const { blueskyProfile, blueskyConnected, farcasterHandle } = useAuthUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Get wallet address and fetch balance
  const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
  const walletAddress = wallet && 'address' in wallet ? wallet.address as `0x${string}` : undefined;

  const { data: balanceData } = useBalance({
    address: walletAddress,
    chainId: 8453, // Base network
  });

  // User has social connection (for create button)
  const hasConnection = blueskyConnected || !!farcasterHandle;

  // Fetch notifications count
  useEffect(() => {
    async function fetchNotifications() {
      if (!authenticated) return;

      try {
        const response = await fetch("/api/notifications");
        const data = await response.json();

        if (data.success) {
          setNotificationCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    }

    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [authenticated]);

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

  // Sync Privy auth with our store
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
    }
  }, [authenticated, user, setSession]);

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
              {/* Create Button - Only show if user has social connections */}
              {hasConnection && (
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
                      <Link
                        href="/feed/create"
                        onClick={() => setShowCreateMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                        Create Post
                      </Link>
                    </div>
                  )}
                </div>
              )}

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
                    src={
                      blueskyProfile?.avatar ||
                      user?.twitter?.profilePictureUrl ||
                      "/defaultpfp.png"
                    }
                  />
                </div>
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
                  {/* Wallet Balance */}
                  {user && walletAddress && balanceData && parseFloat(balanceData.formatted) > 0 && (
                    <>
                      <div className="px-4 py-3 bg-white/5 rounded-xl mb-2">
                        <div className="text-xs text-gray-400 mb-1">Wallet Balance</div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">👛</span>
                          <div className="text-lg font-bold text-white">
                            {parseFloat(balanceData.formatted).toFixed(4)} ETH
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          on Base network
                        </div>
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                    </>
                  )}
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

          {/* Mobile Menu Toggle - Only show for authenticated users */}
          {authenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white"
            >
              {mobileMenuOpen ? (
                <FiX className="text-2xl" />
              ) : (
                <FiMenu className="text-2xl" />
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
              <FiUser className="w-5 h-5" /> Settings
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
