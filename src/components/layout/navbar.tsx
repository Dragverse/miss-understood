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
} from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/lib/store/auth";
import { useCanLivestream } from "@/lib/livestream";
import { useAuthUser } from "@/lib/privy/hooks";
import { SearchDropdown } from "./search-dropdown";

export function Navbar() {
  const { login, logout, authenticated, user } = usePrivy();
  const { setSession, clearAuth } = useAuth();
  const { canStream } = useCanLivestream();
  const { blueskyProfile } = useAuthUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

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
        <div className="flex items-center gap-2">
          {authenticated ? (
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
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a0b2e] border border-white/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
                <Link
                  href="/upload"
                  className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                >
                  Upload Video
                </Link>
                <Link
                  href="/live"
                  className="block w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 rounded-xl transition-colors"
                >
                  Go Live
                </Link>
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
          ) : (
            <button
              onClick={handleLogin}
              className="hidden md:block px-5 py-2 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold text-sm transition"
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
