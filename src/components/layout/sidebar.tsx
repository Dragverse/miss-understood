"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FiHome, FiCompass, FiZap, FiUser, FiSettings, FiAward, FiBarChart2, FiMessageSquare, FiUsers, FiHeadphones, FiBell, FiGlobe, FiInfo } from "react-icons/fi";

const navItems = [
  { href: "/", icon: FiHome, label: "Home" },
  { href: "/feed", icon: FiMessageSquare, label: "Feed" },
  { href: "/videos", icon: FiCompass, label: "Explore" },
  { href: "/snapshots", icon: FiZap, label: "Snapshots" },
  { href: "/audio", icon: FiHeadphones, label: "Audio" },
  { href: "/creators", icon: FiUsers, label: "Creators" },
  { href: "/hall-of-fame", icon: FiAward, label: "Hall of Fame" },
  { href: "/about", icon: FiInfo, label: "About" },
  { href: "/tech-ethics", icon: FiGlobe, label: "Tech & Ethics" },
];

// Authenticated user items (shown at bottom)
const userNavItems = [
  { href: "/dashboard", icon: FiBarChart2, label: "Dashboard" },
  { href: "/profile", icon: FiUser, label: "Profile" },
];

// Mobile bottom nav items
const mobileNavItems = [
  { href: "/", icon: FiHome, label: "Home" },
  { href: "/feed", icon: FiMessageSquare, label: "Feed" },
  { href: "/snapshots", icon: FiZap, label: "Snapshots" },
  { href: "/videos", icon: FiCompass, label: "Explore" },
  { href: "/notifications", icon: FiBell, label: "Notifications", hasNotification: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { authenticated } = usePrivy();
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch notification count
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
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [authenticated]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-20 flex flex-col items-center py-6 gap-3 border-r border-[#2f2942] bg-[#1a0b2e] z-40 hidden md:flex">
        <div className="flex flex-col items-center gap-3 flex-1 overflow-y-auto">
          {/* Main navigation */}
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-[#EB83EA] text-white shadow-lg shadow-[#EB83EA]/30"
                    : "text-gray-400 hover:bg-white/5 hover:text-[#EB83EA]"
                }`}
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          })}
        </div>

        {/* User items at bottom (only when authenticated) */}
        {authenticated && (
          <div className="flex flex-col items-center gap-3 border-t border-[#2f2942] pt-3">
            {userNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${
                    isActive
                      ? "bg-[#EB83EA] text-white shadow-lg shadow-[#EB83EA]/30"
                      : "text-gray-400 hover:bg-white/5 hover:text-[#EB83EA]"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Settings at very bottom */}
        <Link
          href="/settings"
          title="Settings"
          className="w-12 h-12 flex items-center justify-center rounded-2xl text-gray-400 hover:bg-white/5 hover:text-[#EB83EA] transition-all"
        >
          <FiSettings className="w-6 h-6" />
        </Link>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1a0b2e] border-t border-[#2f2942] z-40 md:hidden">
        <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  isActive
                    ? "text-[#EB83EA]"
                    : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 ${isActive ? "scale-110" : ""} transition-transform`} />
                  {item.hasNotification && notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#EB83EA] rounded-full border border-[#1a0b2e]" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
