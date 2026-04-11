"use client";

import { useState, useEffect, useCallback } from "react";
import { FiBell, FiDollarSign, FiHeart, FiMessageCircle, FiUserPlus, FiVideo } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

interface Notification {
  id: string;
  type: "tip" | "like" | "comment" | "follow" | "video_ready";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  avatar?: string;
}

const notificationIcons = {
  tip: FiDollarSign,
  like: FiHeart,
  comment: FiMessageCircle,
  follow: FiUserPlus,
  video_ready: FiVideo,
};

const notificationColors = {
  tip: "text-green-500",
  like: "text-red-500",
  comment: "text-blue-500",
  follow: "text-purple-500",
  video_ready: "text-yellow-500",
};

const notificationTitles: Record<string, string> = {
  tip: "New Tip",
  like: "New Like",
  comment: "New Comment",
  follow: "New Follower",
  video_ready: "Upload Complete",
  mention: "Mentioned You",
  repost: "Reposted",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapDBNotification(dbNotif: any): Notification {
  const type = ["tip", "like", "comment", "follow", "video_ready"].includes(dbNotif.type)
    ? dbNotif.type
    : "comment";

  return {
    id: dbNotif.id,
    type,
    title: notificationTitles[dbNotif.type] || "Notification",
    message: dbNotif.message,
    timestamp: formatRelativeTime(dbNotif.created_at),
    isRead: dbNotif.read,
    actionUrl: dbNotif.link || undefined,
    avatar: undefined,
  };
}

export default function NotificationsPage() {
  const { getAccessToken, user, authenticated } = usePrivy();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.notifications) {
        setNotifications(data.notifications.map(mapDBNotification));
      }
    } catch (err) {
      console.error("[Notifications] Fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (err) {
      console.error("[Notifications] Mark read failed:", err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true, userDID: user?.id }),
      });
    } catch (err) {
      console.error("[Notifications] Mark all read failed:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Notifications</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-gray-400">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 text-sm font-semibold text-[#EB83EA] hover:text-[#E748E6] transition"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
              <FiBell className="w-12 h-12 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-300 mb-2">No notifications yet</h2>
            <p className="text-gray-500 max-w-md">
              When you receive tips, follows, or comments, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = notificationIcons[notification.type];
            const iconColor = notificationColors[notification.type];

            return (
              <Link
                key={notification.id}
                href={notification.actionUrl || "#"}
                onClick={() => markAsRead(notification.id)}
                className={`block p-4 rounded-[20px] border transition-all hover:border-[#EB83EA]/50 ${
                  notification.isRead
                    ? "bg-[#1a0b2e] border-[#2f2942]"
                    : "bg-[#2a1b3e] border-[#EB83EA]/30"
                }`}
              >
                <div className="flex gap-4">
                  {/* Avatar or Icon */}
                  <div className="flex-shrink-0">
                    {notification.avatar ? (
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#EB83EA]">
                        <Image
                          src={notification.avatar}
                          alt="User"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#0f071a] flex items-center justify-center">
                        <Icon className={`w-6 h-6 ${iconColor}`} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-white">
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <span className="flex-shrink-0 w-2 h-2 bg-[#EB83EA] rounded-full mt-1.5" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {notification.timestamp}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
