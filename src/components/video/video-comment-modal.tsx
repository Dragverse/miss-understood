"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FiX, FiSend } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";

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

interface VideoCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
}

export function VideoCommentModal({
  isOpen,
  onClose,
  videoId,
  videoTitle,
}: VideoCommentModalProps) {
  const { user, login } = usePrivy();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, videoId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/social/comment?videoId=${videoId}`);
      const data = await response.json();

      if (data.comments) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert("Please sign in to comment");
      login();
      return;
    }

    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/social/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          authorDID: user.id,
          content: commentText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCommentText("");
        // Reload comments to show the new one
        await loadComments();
      } else {
        alert(data.error || "Failed to post comment");
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a0b2e] border border-[#2f2942] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2f2942]">
          <div>
            <h2 className="text-xl font-bold">Comments</h2>
            <p className="text-sm text-gray-400 mt-1 line-clamp-1">
              {videoTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#EB83EA]"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition"
              >
                <Image
                  src={comment.author?.avatar || "/default-avatar.png"}
                  alt={comment.author?.display_name || "User"}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {comment.author?.display_name || "Unknown User"}
                    </span>
                    {comment.author?.handle && (
                      <span className="text-xs text-gray-400">
                        @{comment.author.handle}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-gray-200 text-sm">
                    {comment.content}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <form
          onSubmit={submitComment}
          className="p-6 border-t border-[#2f2942]"
        >
          <div className="flex gap-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user?.id ? "Write a comment..." : "Sign in to comment"}
              className="flex-1 bg-white/5 border border-[#2f2942] rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-[#EB83EA] transition"
              rows={3}
              disabled={submitting || !user?.id}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submitting || !user?.id}
              className={`px-6 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-xl font-semibold transition flex items-center gap-2 ${
                (!commentText.trim() || submitting || !user?.id)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              <FiSend className="w-5 h-5" />
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
