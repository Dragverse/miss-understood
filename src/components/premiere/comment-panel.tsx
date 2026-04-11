"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { FiSend } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";
import { getSafeAvatar } from "@/lib/utils/thumbnail-helpers";

interface Comment {
  id: string;
  author_did: string;
  content: string;
  created_at: string;
  author?: {
    display_name: string;
    handle: string;
    avatar: string;
  };
}

interface PremiereCommentPanelProps {
  videoId: string;
  active: boolean; // Only poll when active (watching phase)
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function PremiereCommentPanel({ videoId, active }: PremiereCommentPanelProps) {
  const { user, login, getAccessToken, authenticated } = usePrivy();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch comments (initial + polling)
  useEffect(() => {
    if (!active) return;

    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/social/comment?videoId=${videoId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.comments) {
          setComments(data.comments);
        }
      } catch {
        // Silently ignore during premiere
      }
    };

    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [videoId, active]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (commentsEndRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [comments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      login();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      const authToken = await getAccessToken();
      const response = await fetch("/api/social/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ videoId, content: commentText }),
      });

      const data = await response.json();
      if (data.success) {
        setCommentText("");
        // Immediate refresh
        const res = await fetch(`/api/social/comment?videoId=${videoId}`);
        const refreshed = await res.json();
        if (refreshed.comments) setComments(refreshed.comments);
      }
    } catch {
      // Silently fail during premiere
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a0b2e] border border-[#2f2942] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2f2942] flex-shrink-0">
        <h3 className="text-sm font-bold text-white">
          Live Chat
          {comments.length > 0 && (
            <span className="text-gray-500 ml-2 font-normal">{comments.length}</span>
          )}
        </h3>
      </div>

      {/* Comments list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[400px] lg:max-h-none"
      >
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={getSafeAvatar(comment.author?.avatar, "/defaultpfp.png")}
                  alt={comment.author?.display_name || "User"}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-[#EB83EA] truncate">
                    {comment.author?.display_name || comment.author?.handle || "Anonymous"}
                  </span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 break-words">{comment.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment input */}
      <div className="p-3 border-t border-[#2f2942] flex-shrink-0">
        {authenticated ? (
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Say something..."
              className="flex-1 px-3 py-2 bg-[#2f2942] border border-[#EB83EA]/20 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#EB83EA]"
              disabled={submitting}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="w-9 h-9 rounded-full bg-[#EB83EA] hover:bg-[#E748E6] flex items-center justify-center transition disabled:opacity-50"
            >
              <FiSend className="w-4 h-4 text-white" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => login()}
            className="w-full py-2 text-sm text-[#EB83EA] hover:text-[#E748E6] font-semibold transition"
          >
            Sign in to chat
          </button>
        )}
      </div>
    </div>
  );
}
