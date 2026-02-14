"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { FiX, FiSend } from "react-icons/fi";
import { parseTextWithLinks } from "@/lib/text-parser";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface Comment {
  id: string;
  author: {
    displayName: string;
    handle: string;
    avatar: string;
  };
  // DB-backed comments use these fields
  author_did?: string;
  content?: string;
  created_at?: string;
  // Bluesky comments use these fields
  text?: string;
  createdAt?: string;
  likeCount?: number;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  postUri: string;
  postCid: string;
  postAuthor: {
    displayName: string;
    handle: string;
  };
}

export function CommentModal({
  isOpen,
  onClose,
  postUri,
  postCid,
  postAuthor,
}: CommentModalProps) {
  const { user, login, getAccessToken } = usePrivy();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract Dragverse post/video ID from URI
  const isDragversePost = postUri?.startsWith("dragverse:");
  const dragverseId = isDragversePost ? postUri.replace("dragverse:", "") : null;
  const isBlueskyPost = postUri && !isDragversePost && postCid;

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComments();
      // Focus the textarea after modal opens
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, postUri]);

  const loadComments = async () => {
    setLoading(true);
    try {
      let allComments: Comment[] = [];

      if (isDragversePost && dragverseId) {
        // Use database-backed comment API for Dragverse posts
        const response = await fetch(`/api/posts/comment?postId=${dragverseId}`);
        const data = await response.json();
        if (data.comments) {
          allComments = data.comments.map((c: any) => ({
            id: c.id,
            author: {
              displayName: c.creator?.display_name || "Dragverse User",
              handle: c.creator?.handle || `user-${(c.creator_did || "").substring(0, 8)}`,
              avatar: c.creator?.avatar || "/defaultpfp.png",
            },
            text: c.text_content,
            createdAt: c.created_at,
          }));
        }
      } else if (isBlueskyPost) {
        // Fetch from Bluesky API
        try {
          const response = await fetch(
            `/api/bluesky/comment?postUri=${encodeURIComponent(postUri)}`
          );
          const data = await response.json();
          if (data.success) {
            allComments = data.comments;
          }
        } catch (error) {
          console.error("Failed to load Bluesky comments:", error);
        }
      }

      setComments(allComments);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    if (!user?.id) {
      toast.error("Please sign in to comment");
      login();
      return;
    }

    setSubmitting(true);
    try {
      if (isDragversePost && dragverseId) {
        // Use database-backed API for Dragverse posts
        const authToken = await getAccessToken();
        const response = await fetch("/api/posts/comment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            postId: dragverseId,
            content: commentText,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || "Failed to post comment");
          return;
        }

        toast.success("Comment posted!");
      } else if (isBlueskyPost) {
        // Sync to Bluesky
        const response = await fetch("/api/bluesky/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postUri,
            postCid,
            text: commentText,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || "Failed to post comment");
          return;
        }

        toast.success("Comment posted!");
      }

      setCommentText("");
      await loadComments();
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  // Submit on Enter (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (commentText.trim() && !submitting) {
        submitComment(e as any);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a0b2e] border border-[#2f2942] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2f2942]">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">Comments</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              on @{postAuthor.handle}&apos;s post
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition ml-3"
            aria-label="Close comments"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-[#EB83EA]"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No comments yet</p>
              <p className="text-gray-600 text-xs mt-1">Be the first to share your thoughts</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 py-3"
              >
                <Image
                  src={comment.author?.avatar || "/defaultpfp.png"}
                  alt={comment.author?.displayName || "User"}
                  width={36}
                  height={36}
                  className="rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-white">
                      {comment.author?.displayName || "User"}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(comment.createdAt || comment.created_at || "").toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed">
                    {parseTextWithLinks(comment.text || comment.content || "")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input — compact, inline send */}
        <form
          onSubmit={submitComment}
          className="px-4 py-3 border-t border-[#2f2942]"
        >
          <div className="flex items-end gap-2 bg-white/5 border border-[#2f2942] rounded-xl px-3 py-2 focus-within:border-[#EB83EA]/50 transition">
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={user?.id ? "Add a comment..." : "Sign in to comment"}
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none leading-relaxed"
              rows={1}
              disabled={submitting || !user?.id}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submitting || !user?.id}
              className={`p-2 rounded-lg transition flex-shrink-0 ${
                commentText.trim() && !submitting && user?.id
                  ? "bg-[#EB83EA] text-white hover:bg-[#E748E6]"
                  : "text-gray-600 cursor-not-allowed"
              }`}
              aria-label="Post comment"
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5 px-1">
            Press Enter to send · Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
