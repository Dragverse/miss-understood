"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FiHome, FiCompass, FiZap, FiUser, FiSettings, FiAward, FiBarChart2, FiMessageSquare, FiUsers, FiHeadphones, FiBell } from "react-icons/fi";

const navItems = [
  { href: "/", icon: FiHome, label: "Home" },
  { href: "/feed", icon: FiMessageSquare, label: "Feed" },
  { href: "/videos", icon: FiCompass, label: "Explore" },
  { href: "/shorts", icon: FiZap, label: "Bytes" },
  { href: "/audio", icon: FiHeadphones, label: "Audio" },
  { href: "/creators", icon: FiUsers, label: "Creators" },
  { href: "/hall-of-fame", icon: FiAward, label: "Hall of Fame" },
  { href: "/dashboard", icon: FiBarChart2, label: "Dashboard" },
  { href: "/profile", icon: FiUser, label: "Profile" },
];

// Mobile bottom nav items (first 4 + notifications)
const mobileNavItems = [
  { href: "/", icon: FiHome, label: "Home" },
  { href: "/feed", icon: FiMessageSquare, label: "Feed" },
  { href: "/videos", icon: FiCompass, label: "Explore" },
  { href: "/shorts", icon: FiZap, label: "Bytes" },
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
      <aside className="fixed left-0 top-16 bottom-0 w-20 flex flex-col items-center py-6 gap-6 border-r border-[#2f2942] bg-[#1a0b2e] z-40 hidden md:flex">
        {navItems.map((item) => {
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

        <Link
          href="/settings"
          title="Settings"
          className="w-12 h-12 flex items-center justify-center rounded-2xl text-gray-400 hover:bg-white/5 hover:text-[#EB83EA] transition-all mt-auto"
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
