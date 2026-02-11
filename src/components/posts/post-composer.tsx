"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FiImage, FiX, FiSmile, FiMapPin, FiSend, FiLoader, FiHeart, FiActivity, FiFilm, FiAward, FiStar, FiShare, FiMessageSquare } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";
import { usePrivy } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface PostComposerProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

const MOODS = [
  { icon: FiStar, label: "Sparkling", value: "sparkling" },
  { icon: FiHeart, label: "Soft", value: "soft" },
  { icon: FiActivity, label: "Fierce", value: "fierce" },
  { icon: FiFilm, label: "Dramatic", value: "dramatic" },
  { icon: FiSmile, label: "Playful", value: "playful" },
  { icon: FiAward, label: "Regal", value: "regal" },
  { icon: FiStar, label: "Slay", value: "slay" },
  { icon: FiSmile, label: "Magical", value: "magical" }, // Using FiSmile as alternative to sparkle emoji
];

export function PostComposer({ onPostCreated, placeholder = "Share your story..." }: PostComposerProps) {
  const { getAccessToken, user } = usePrivy();
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cross-posting state
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    dragverse: true, // Always true
    bluesky: false,
    farcaster: false,
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState({
    bluesky: false,
    farcaster: false,
  });
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  // Load user's default crosspost settings
  useEffect(() => {
    async function loadCrosspostSettings() {
      try {
        const authToken = await getAccessToken();
        if (!authToken) {
          console.log("[PostComposer] No auth token available");
          return;
        }

        console.log("[PostComposer] Loading crosspost settings...");
        const response = await fetch("/api/user/crosspost-settings", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("[PostComposer] Crosspost settings loaded:", data);
          if (data.success) {
            console.log("[PostComposer] Connected platforms:", {
              bluesky: data.connected.bluesky,
              farcaster: data.connected.farcaster,
            });
            setSelectedPlatforms({
              dragverse: true,
              bluesky: data.settings.bluesky && data.connected.bluesky,
              farcaster: data.settings.farcaster && data.connected.farcaster,
            });
            setConnectedPlatforms(data.connected);
          }
        } else {
          console.error("[PostComposer] Failed to load settings:", response.status);
        }
      } catch (error) {
        console.error("[PostComposer] Failed to load crosspost settings:", error);
      }
    }

    loadCrosspostSettings();
  }, [getAccessToken]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 images
    const newFiles = [...mediaFiles, ...files].slice(0, 4);
    setMediaFiles(newFiles);

    // Create previews
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreviews((prev) => [...prev, reader.result as string].slice(0, 4));
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

      // Upload media first if any
      const uploadedMediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      if (mediaFiles.length > 0) {
        toast.loading(`Uploading ${mediaFiles.length} image${mediaFiles.length > 1 ? 's' : ''}...`, { id: loadingToast });
      }

      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);

        // Use v2 route to bypass aggressive browser caching
        const uploadResponse = await fetch("/api/upload/image-v2", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });

        if (uploadResponse.ok) {
          const data = await uploadResponse.json();
          uploadedMediaUrls.push(data.url);
          mediaTypes.push(file.type.startsWith("image/gif") ? "gif" : "image");
        } else {
          // Image upload failed
          const errorData = await uploadResponse.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || "Failed to upload image");
        }
      }

      // Create post
      console.log("[PostComposer] Creating post with platforms:", selectedPlatforms);
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
          mood: selectedMood,
          visibility: "public",
          platforms: selectedPlatforms,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Reset form
        setContent("");
        setMediaFiles([]);
        setMediaPreviews([]);
        setSelectedMood(null);
        setShowMoodPicker(false);

        console.log("[PostComposer] Post created, crosspost results:", result.crosspost);

        // Check crosspost results and show appropriate message
        const crosspostSuccess: string[] = [];
        const crosspostErrors: string[] = [];

        if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.success) {
          crosspostSuccess.push("Bluesky");
        } else if (selectedPlatforms.bluesky && result.crosspost?.bluesky?.error) {
          crosspostErrors.push(`Bluesky: ${result.crosspost.bluesky.error}`);
        }

        if (selectedPlatforms.farcaster && result.crosspost?.farcaster?.success) {
          crosspostSuccess.push("Farcaster");
        } else if (selectedPlatforms.farcaster && result.crosspost?.farcaster?.needsSetup) {
          crosspostErrors.push("Farcaster: Please set up native posting in settings");
        } else if (selectedPlatforms.farcaster && result.crosspost?.farcaster?.error) {
          crosspostErrors.push(`Farcaster: ${result.crosspost.farcaster.error}`);
        }

        // Show success message
        if (crosspostSuccess.length > 0) {
          toast.success(
            `Posted to Dragverse and ${crosspostSuccess.join(", ")}! ✨`,
            { id: loadingToast }
          );
        } else {
          toast.success("Post created successfully! ✨", { id: loadingToast });
        }

        // Show crosspost errors if any
        if (crosspostErrors.length > 0) {
          setTimeout(() => {
            crosspostErrors.forEach((error) => toast.error(error));
          }, 500);
        }

        if (onPostCreated) {
          onPostCreated();
        }
      } else {
        // Post creation failed
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

  return (
    <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/20 shadow-xl shadow-[#EB83EA]/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center overflow-hidden">
          <FiSmile className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold">What's your story, babe?</p>
          <p className="text-[#EB83EA]/60 text-sm">Share a moment, a look, a feeling...</p>
        </div>
      </div>

      {/* Text input */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0f071a]/60 border-2 border-[#EB83EA]/10 focus:border-[#EB83EA]/40 rounded-2xl p-4 text-white placeholder-gray-500 resize-none outline-none transition-all min-h-[120px] text-lg"
        maxLength={500}
      />

      {/* Character count */}
      <div className="flex justify-end mt-2 mb-4">
        <span className={`text-sm ${content.length > 450 ? "text-[#EB83EA]" : "text-gray-500"}`}>
          {content.length}/500
        </span>
      </div>

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {mediaPreviews.map((preview, index) => (
            <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group">
              <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" />
              <button
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-black/80 hover:bg-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FiX className="text-white" />
              </button>
              {/* Sparkle overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#EB83EA]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}

      {/* Mood picker */}
      {showMoodPicker && (
        <div className="mb-4 p-4 bg-[#0f071a]/60 rounded-2xl border-2 border-[#EB83EA]/20">
          <p className="text-white font-semibold mb-3 flex items-center gap-2">
            <FiSmile className="text-[#EB83EA]" />
            What's the vibe?
          </p>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map((mood) => {
              const MoodIcon = mood.icon;
              return (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value === selectedMood ? null : mood.value)}
                  className={`p-3 rounded-xl transition-all ${
                    selectedMood === mood.value
                      ? "bg-[#EB83EA] text-white scale-105"
                      : "bg-[#2f2942] text-gray-300 hover:bg-[#2f2942]/80"
                  }`}
                >
                  <MoodIcon className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs font-semibold block">{mood.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected mood display */}
      {selectedMood && !showMoodPicker && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-[#EB83EA]/20 rounded-full border border-[#EB83EA]/30">
          {(() => {
            const MoodIcon = MOODS.find((m) => m.value === selectedMood)?.icon;
            return MoodIcon ? <MoodIcon className="w-5 h-5 text-white" /> : null;
          })()}
          <span className="text-white text-sm font-semibold">
            {MOODS.find((m) => m.value === selectedMood)?.label}
          </span>
          <button onClick={() => setSelectedMood(null)} className="text-white/60 hover:text-white">
            <FiX size={16} />
          </button>
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
            {/* Dragverse (always on) */}
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

            {/* Bluesky */}
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

            {/* Farcaster */}
            <div className="flex items-center justify-between p-3 bg-[#2f2942] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="text-white font-semibold">Farcaster</span>
              </div>
              {connectedPlatforms.farcaster ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.farcaster}
                    onChange={(e) =>
                      setSelectedPlatforms((prev) => ({
                        ...prev,
                        farcaster: e.target.checked,
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
      {!showPlatformPicker && (selectedPlatforms.bluesky || selectedPlatforms.farcaster) && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gray-400 text-sm">Posting to:</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#EB83EA]/20 rounded-full border border-[#EB83EA]/30">
              <FiMessageSquare className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-semibold">Dragverse</span>
            </span>
            {selectedPlatforms.bluesky && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
                <SiBluesky className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-xs font-semibold">Bluesky</span>
              </span>
            )}
            {selectedPlatforms.farcaster && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                <span className="text-purple-400 text-xs font-bold">F</span>
                <span className="text-purple-400 text-xs font-semibold">Farcaster</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-[#EB83EA]/10">
        <div className="flex gap-2">
          {/* Photo/GIF upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaFiles.length >= 4}
            className="p-3 rounded-xl bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add photos or GIFs (up to 4)"
          >
            <FiImage size={20} />
          </button>

          {/* Mood picker toggle */}
          <button
            onClick={() => setShowMoodPicker(!showMoodPicker)}
            className={`p-3 rounded-xl transition-all ${
              showMoodPicker
                ? "bg-[#EB83EA] text-white"
                : "bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA]"
            }`}
            title="Set the mood"
          >
            <FiSmile size={20} />
          </button>

          {/* Platform picker toggle */}
          <button
            onClick={() => setShowPlatformPicker(!showPlatformPicker)}
            className={`p-3 rounded-xl transition-all ${
              showPlatformPicker
                ? "bg-[#EB83EA] text-white"
                : "bg-[#2f2942] hover:bg-[#EB83EA]/20 text-[#EB83EA]"
            }`}
            title="Choose platforms"
          >
            <FiShare size={20} />
          </button>

          {/* Location (future feature) */}
          <button
            className="p-3 rounded-xl bg-[#2f2942] hover:bg-[#EB83EA]/20 text-gray-500 transition-all opacity-50 cursor-not-allowed"
            title="Add location (coming soon)"
            disabled
          >
            <FiMapPin size={20} />
          </button>
        </div>

        {/* Post button */}
        <button
          onClick={handlePost}
          disabled={(!content.trim() && mediaFiles.length === 0) || isUploading}
          className="px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6d28d9] text-white font-bold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-[#EB83EA]/30"
        >
          {isUploading ? (
            <>
              <FiLoader className="animate-spin" size={20} />
              Posting...
            </>
          ) : (
            <>
              <FiSend size={20} />
              Post Your Story
            </>
          )}
        </button>
      </div>

      {/* Hidden file input */}
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
