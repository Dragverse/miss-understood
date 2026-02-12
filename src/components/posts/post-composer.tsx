"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { FiImage, FiX, FiSmile, FiSend, FiLoader, FiShare, FiMessageSquare } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface PostComposerProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

// Curated emoji categories for the drag community
const EMOJI_CATEGORIES = [
  {
    name: "Favorites",
    emojis: ["💖", "✨", "💅", "👑", "🔥", "💜", "🌈", "💋", "🦋", "⭐", "🎭", "💃", "🪩", "🎤", "😍", "🥰", "😘", "🤩", "💕", "💫"],
  },
  {
    name: "Faces",
    emojis: ["😂", "🥹", "😭", "🤣", "😏", "😌", "🤭", "😈", "🙄", "🤪", "😜", "🥺", "😤", "🫣", "🤫", "😇", "🫠", "😮‍💨", "💀", "👀"],
  },
  {
    name: "Gestures",
    emojis: ["👏", "🙌", "💪", "🤝", "✌️", "🤞", "👊", "🫶", "💅", "🤌", "👋", "🫡", "🤗", "🫰", "🙏", "👆", "🖤", "❤️‍🔥", "🩷", "💗"],
  },
  {
    name: "Objects",
    emojis: ["🎀", "💎", "👠", "👗", "💄", "🪭", "🎪", "🏳️‍🌈", "🏳️‍⚧️", "🎵", "🎶", "📸", "🍾", "🥂", "🌟", "🌸", "🌺", "🎉", "🎊", "🪄"],
  },
];

export function PostComposer({ onPostCreated, placeholder = "Share your story..." }: PostComposerProps) {
  const { getAccessToken } = usePrivy();
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Cross-posting state
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    dragverse: true,
    bluesky: false,
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState({
    bluesky: false,
  });
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  // Load user's default crosspost settings
  useEffect(() => {
    async function loadCrosspostSettings() {
      try {
        const authToken = await getAccessToken();
        if (!authToken) return;

        const response = await fetch("/api/user/crosspost-settings", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSelectedPlatforms({
              dragverse: true,
              bluesky: data.settings.bluesky && data.connected.bluesky,
            });
            setConnectedPlatforms(data.connected);
          }
        }
      } catch (error) {
        console.error("[PostComposer] Failed to load crosspost settings:", error);
      }
    }

    loadCrosspostSettings();
  }, [getAccessToken]);

  // Close emoji picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  const insertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      if (newContent.length <= 500) {
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
        });
      }
    } else {
      if ((content + emoji).length <= 500) {
        setContent(content + emoji);
      }
    }
  }, [content]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...mediaFiles, ...files].slice(0, 4);
    setMediaFiles(newFiles);

    const newPreviews: string[] = [];
    let loaded = 0;
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        loaded++;
        if (loaded === newFiles.length) {
          setMediaPreviews(newPreviews.slice(0, 4));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error("Please add some content to your post");
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading("Creating your post...");

    try {
      const authToken = await getAccessToken();

      const uploadedMediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      if (mediaFiles.length > 0) {
        toast.loading(`Uploading ${mediaFiles.length} image${mediaFiles.length > 1 ? 's' : ''}...`, { id: loadingToast });
      }

      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/upload/image-v2", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        });

        if (uploadResponse.ok) {
          const data = await uploadResponse.json();
          uploadedMediaUrls.push(data.url);
          mediaTypes.push(file.type.startsWith("image/gif") ? "gif" : "image");
        } else {
          const errorData = await uploadResponse.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || "Failed to upload image");
        }
      }

      const response = await fetch("/api/posts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          textContent: content,
          mediaUrls: uploadedMediaUrls,
          mediaTypes,
          visibility: "public",
          platforms: selectedPlatforms,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        setContent("");
        setMediaFiles([]);
        setMediaPreviews([]);
        setShowEmojiPicker(false);

        const crosspostSuccess: string[] = [];
        const crosspostErrors: string[] = [];

        if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.success) {
          crosspostSuccess.push("Bluesky");
        } else if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.error) {
          crosspostErrors.push(`Bluesky: ${result.crosspost.bluesky.error}`);
        }

        if (crosspostSuccess.length > 0) {
          toast.success(
            `Posted to Dragverse and ${crosspostSuccess.join(", ")}!`,
            { id: loadingToast }
          );
        } else {
          toast.success("Post created successfully!", { id: loadingToast });
        }

        if (crosspostErrors.length > 0) {
          setTimeout(() => {
            crosspostErrors.forEach((error) => toast.error(error));
          }, 500);
        }

        if (onPostCreated) {
          onPostCreated();
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to create post" }));
        throw new Error(errorData.error || "Failed to create post");
      }
    } catch (error) {
      console.error("Failed to create post:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create post. Please try again.",
        { id: loadingToast }
      );
    } finally {
      setIsUploading(false);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 450;
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0) && !isUploading;

  return (
    <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-5 sm:p-6 border-2 border-[#EB83EA]/20 shadow-xl shadow-[#EB83EA]/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center overflow-hidden flex-shrink-0">
          <FiSmile className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm sm:text-base">What&apos;s your story, babe?</p>
          <p className="text-[#EB83EA]/60 text-xs sm:text-sm truncate">Share a moment, a look, a feeling...</p>
        </div>
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0f071a]/60 border-2 border-[#EB83EA]/10 focus:border-[#EB83EA]/40 rounded-2xl p-4 text-white placeholder-gray-500 resize-none outline-none transition-all min-h-[100px] sm:min-h-[120px] text-base sm:text-lg"
        maxLength={500}
      />

      {/* Character count */}
      <div className="flex justify-end mt-1 mb-3">
        <span className={`text-xs ${isOverLimit ? "text-[#EB83EA] font-semibold" : "text-gray-500"}`}>
          {charCount}/500
        </span>
      </div>

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className={`grid gap-2 mb-4 ${mediaPreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {mediaPreviews.map((preview, index) => (
            <div key={index} className={`relative ${mediaPreviews.length === 1 ? "aspect-video" : "aspect-square"} rounded-2xl overflow-hidden group`}>
              <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" />
              <button
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-black/80 hover:bg-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${index + 1}`}
              >
                <FiX className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="mb-4 bg-[#0f071a]/80 rounded-2xl border-2 border-[#EB83EA]/20 overflow-hidden">
          <div className="flex border-b border-[#EB83EA]/10 overflow-x-auto scrollbar-hide">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setActiveEmojiCategory(i)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeEmojiCategory === i
                    ? "text-[#EB83EA] border-b-2 border-[#EB83EA]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="p-3 grid grid-cols-10 gap-1 max-h-[160px] overflow-y-auto">
            {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#EB83EA]/20 rounded-lg transition-all hover:scale-110"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platform picker */}
      {showPlatformPicker && (
        <div className="mb-4 p-4 bg-[#0f071a]/60 rounded-2xl border-2 border-[#EB83EA]/20">
          <p className="text-white font-semibold mb-3 flex items-center gap-2">
            <FiShare className="text-[#EB83EA]" />
            Where to post?
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#2f2942] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
                  <FiMessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold">Dragverse</span>
              </div>
              <span className="text-xs px-3 py-1 bg-[#EB83EA]/20 text-[#EB83EA] rounded-full">
                Always On
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#2f2942] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <SiBluesky className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold">Bluesky</span>
              </div>
              {connectedPlatforms.bluesky ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.bluesky}
                    onChange={(e) =>
                      setSelectedPlatforms((prev) => ({
                        ...prev,
                        bluesky: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#EB83EA]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EB83EA]"></div>
                </label>
              ) : (
                <span className="text-xs px-3 py-1 bg-gray-600/30 text-gray-400 rounded-full">
                  Not Connected
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected platforms display */}
      {!showPlatformPicker && selectedPlatforms.bluesky && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gray-400 text-sm">Posting to:</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#EB83EA]/20 rounded-full border border-[#EB83EA]/30">
              <FiMessageSquare className="w-3 h-3 text-white" />
              <span className="text-white text-xs font-semibold">Dragverse</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
              <SiBluesky className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 text-xs font-semibold">Bluesky</span>
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-[#EB83EA]/10">
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaFiles.length >= 4}
            className="p-2.5 sm:p-3 rounded-xl bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add photos (up to 4)"
            aria-label="Add photos"
          >
            <FiImage size={20} />
          </button>

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2.5 sm:p-3 rounded-xl transition-all ${
              showEmojiPicker
                ? "bg-[#EB83EA] text-white"
                : "bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA]"
            }`}
            title="Add emoji"
            aria-label="Add emoji"
          >
            <FiSmile size={20} />
          </button>

          <button
            onClick={() => setShowPlatformPicker(!showPlatformPicker)}
            className={`p-2.5 sm:p-3 rounded-xl transition-all ${
              showPlatformPicker
                ? "bg-[#EB83EA] text-white"
                : "bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA]"
            }`}
            title="Choose platforms"
            aria-label="Choose platforms"
          >
            <FiShare size={20} />
          </button>
        </div>

        <button
          onClick={handlePost}
          disabled={!canPost}
          className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white font-bold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-[#EB83EA]/30"
        >
          {isUploading ? (
            <>
              <FiLoader className="animate-spin" size={18} />
              <span className="hidden sm:inline">Posting...</span>
            </>
          ) : (
            <>
              <FiSend size={18} />
              <span className="hidden sm:inline">Post</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
