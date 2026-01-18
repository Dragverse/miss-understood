"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { FiImage, FiX, FiSmile, FiMapPin, FiSend, FiLoader } from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";

interface PostComposerProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

const MOODS = [
  { emoji: "✨", label: "Sparkling", value: "sparkling" },
  { emoji: "💖", label: "Soft", value: "soft" },
  { emoji: "🔥", label: "Fierce", value: "fierce" },
  { emoji: "🎭", label: "Dramatic", value: "dramatic" },
  { emoji: "🌈", label: "Playful", value: "playful" },
  { emoji: "👑", label: "Regal", value: "regal" },
  { emoji: "💅", label: "Slay", value: "slay" },
  { emoji: "🦄", label: "Magical", value: "magical" },
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
    if (!content.trim() && mediaFiles.length === 0) return;

    setIsUploading(true);
    try {
      const authToken = await getAccessToken();

      // Upload media first if any
      const uploadedMediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/upload/image", {
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
        }
      }

      // Create post
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
        }),
      });

      if (response.ok) {
        // Reset form
        setContent("");
        setMediaFiles([]);
        setMediaPreviews([]);
        setSelectedMood(null);
        setShowMoodPicker(false);

        if (onPostCreated) {
          onPostCreated();
        }
      }
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#18122D] to-[#1a0b2e] rounded-3xl p-6 border-2 border-[#EB83EA]/20 shadow-xl shadow-[#EB83EA]/10">
      {/* Header with sparkles */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center overflow-hidden">
          <span className="text-2xl">✨</span>
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
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                onClick={() => setSelectedMood(mood.value === selectedMood ? null : mood.value)}
                className={`p-3 rounded-xl transition-all ${
                  selectedMood === mood.value
                    ? "bg-[#EB83EA] text-white scale-105"
                    : "bg-[#2f2942] text-gray-300 hover:bg-[#2f2942]/80"
                }`}
              >
                <span className="text-2xl block mb-1">{mood.emoji}</span>
                <span className="text-xs font-semibold">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected mood display */}
      {selectedMood && !showMoodPicker && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-[#EB83EA]/20 rounded-full border border-[#EB83EA]/30">
          <span className="text-xl">
            {MOODS.find((m) => m.value === selectedMood)?.emoji}
          </span>
          <span className="text-white text-sm font-semibold">
            {MOODS.find((m) => m.value === selectedMood)?.label}
          </span>
          <button onClick={() => setSelectedMood(null)} className="text-white/60 hover:text-white">
            <FiX size={16} />
          </button>
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
