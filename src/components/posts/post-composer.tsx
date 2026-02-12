"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FiImage, FiX, FiSmile, FiSend, FiLoader, FiShare, FiMessageSquare } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface PostComposerProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

export function PostComposer({ onPostCreated, placeholder = "Share your story..." }: PostComposerProps) {
  const { getAccessToken } = usePrivy();
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.max(100, textarea.scrollHeight) + "px";
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
        toast.loading(`Uploading ${mediaFiles.length} image${mediaFiles.length > 1 ? "s" : ""}...`, { id: loadingToast });
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

        const crosspostSuccess: string[] = [];
        const crosspostErrors: string[] = [];

        if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.success) {
          crosspostSuccess.push("Bluesky");
        } else if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.error) {
          crosspostErrors.push(`Bluesky: ${result.crosspost.bluesky.error}`);
        }

        if (crosspostSuccess.length > 0) {
          toast.success(`Posted to Dragverse and ${crosspostSuccess.join(", ")}!`, { id: loadingToast });
        } else {
          toast.success("Post created successfully!", { id: loadingToast });
        }

        if (crosspostErrors.length > 0) {
          setTimeout(() => {
            crosspostErrors.forEach((err) => toast.error(err));
          }, 500);
        }

        onPostCreated?.();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to create post" }));
        throw new Error(errorData.error || "Failed to create post");
      }
    } catch (error) {
      console.error("Failed to create post:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create post. Please try again.", { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 400;
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0) && !isUploading;

  return (
    <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-5 sm:p-6 border-2 border-[#EB83EA]/20 shadow-xl shadow-[#EB83EA]/10">
      {/* Text input - contentEditable-style textarea that auto-grows */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 resize-none outline-none text-base sm:text-lg leading-relaxed min-h-[100px]"
        maxLength={500}
      />

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className={`grid gap-2 mb-4 ${mediaPreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {mediaPreviews.map((preview, index) => (
            <div key={index} className={`relative ${mediaPreviews.length === 1 ? "aspect-video" : "aspect-square"} rounded-2xl overflow-hidden group`}>
              <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" />
              <button
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${index + 1}`}
              >
                <FiX className="text-white w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Platform picker */}
      {showPlatformPicker && (
        <div className="mb-4 p-4 bg-[#0f071a]/60 rounded-2xl border border-[#EB83EA]/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#2f2942] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
                  <FiMessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold text-sm">Dragverse</span>
              </div>
              <span className="text-[10px] px-2.5 py-1 bg-[#EB83EA]/20 text-[#EB83EA] rounded-full font-medium">Always On</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#2f2942] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <SiBluesky className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold text-sm">Bluesky</span>
              </div>
              {connectedPlatforms.bluesky ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.bluesky}
                    onChange={(e) => setSelectedPlatforms((prev) => ({ ...prev, bluesky: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EB83EA]"></div>
                </label>
              ) : (
                <span className="text-[10px] px-2.5 py-1 bg-gray-600/30 text-gray-400 rounded-full font-medium">Not Connected</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar: platforms display + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-1">
          {/* Photo upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaFiles.length >= 4}
            className="p-2.5 rounded-full hover:bg-[#EB83EA]/10 text-[#EB83EA] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Add photos (up to 4)"
            aria-label="Add photos"
          >
            <FiImage size={20} />
          </button>

          {/* Emoji - triggers native OS emoji picker */}
          <button
            onClick={() => {
              // Focus textarea then trigger native emoji keyboard
              const textarea = textareaRef.current;
              if (textarea) {
                textarea.focus();
                // On macOS: Cmd+Ctrl+Space, on Windows: Win+.
                // For mobile: focusing the textarea should bring up keyboard with emoji access
                // For desktop: we show a hint
                if (navigator.userAgent.includes("Mac")) {
                  toast("Press ⌘ + Ctrl + Space for emoji keyboard", { icon: "😊", duration: 3000 });
                } else if (navigator.userAgent.includes("Win")) {
                  toast("Press Win + . for emoji keyboard", { icon: "😊", duration: 3000 });
                } else {
                  toast("Use your keyboard emoji picker", { icon: "😊", duration: 3000 });
                }
              }
            }}
            className="p-2.5 rounded-full hover:bg-[#EB83EA]/10 text-[#EB83EA] transition-all"
            title="Add emoji"
            aria-label="Add emoji"
          >
            <FiSmile size={20} />
          </button>

          {/* Platform picker */}
          <button
            onClick={() => setShowPlatformPicker(!showPlatformPicker)}
            className={`p-2.5 rounded-full transition-all ${
              showPlatformPicker ? "bg-[#EB83EA]/20 text-[#EB83EA]" : "hover:bg-[#EB83EA]/10 text-[#EB83EA]"
            }`}
            title="Choose platforms"
            aria-label="Choose platforms"
          >
            <FiShare size={20} />
          </button>

          {/* Platform badges inline */}
          {selectedPlatforms.bluesky && !showPlatformPicker && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 rounded-full border border-blue-500/20">
                <SiBluesky className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400 text-[10px] font-semibold">Bluesky</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Character count - only show when near limit */}
          {isNearLimit && (
            <span className={`text-xs tabular-nums ${charCount > 480 ? "text-red-400 font-bold" : "text-gray-500"}`}>
              {500 - charCount}
            </span>
          )}

          {/* Post button */}
          <button
            onClick={handlePost}
            disabled={!canPost}
            className="px-5 py-2 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white font-bold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {isUploading ? (
              <FiLoader className="animate-spin" size={16} />
            ) : (
              <FiSend size={16} />
            )}
            <span>{isUploading ? "Posting..." : "Post"}</span>
          </button>
        </div>
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
