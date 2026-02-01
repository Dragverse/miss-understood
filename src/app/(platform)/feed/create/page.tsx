"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiImage, FiX, FiArrowLeft } from "react-icons/fi";
import Link from "next/link";
import toast from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthUser } from "@/lib/privy/hooks";

export default function CreatePostPage() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { isAuthenticated } = useAuthUser();
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [isBlueskyConnected, setIsBlueskyConnected] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    dragverse: true,
    bluesky: false,
    farcaster: false,
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState({
    bluesky: false,
    farcaster: false,
  });

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/bluesky/session");
        const data = await response.json();

        if (data.connected) {
          setIsBlueskyConnected(true);
        }
      } catch (error) {
        console.error("Bluesky session check error:", error);
      } finally {
        setIsCheckingSession(false);
      }
    }

    if (isAuthenticated) {
      checkSession();
    }
  }, [isAuthenticated, router]);

  // Load crosspost settings
  useEffect(() => {
    async function loadCrosspostSettings() {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const response = await fetch("/api/user/crosspost-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSelectedPlatforms({
              dragverse: true,
              // Auto-enable if connected, regardless of saved preference
              bluesky: data.connected.bluesky,
              farcaster: data.connected.farcaster,
            });
            setConnectedPlatforms(data.connected);
          }
        }
      } catch (error) {
        console.error("Failed to load crosspost settings:", error);
      }
    }

    if (isAuthenticated) {
      loadCrosspostSettings();
    }
  }, [isAuthenticated, getAccessToken]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      toast.error("Maximum 4 images per post");
      return;
    }

    setImages([...images, ...files]);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!text.trim() && images.length === 0) {
      toast.error("Post must have text or images");
      return;
    }

    setPosting(true);

    try {
      // Get authentication token for image uploads
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const imageUrls: string[] = [];

      if (images.length > 0) {
        setUploadProgress({ current: 0, total: images.length });

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const formData = new FormData();
          formData.append("file", image);

          setUploadProgress({ current: i + 1, total: images.length });
          const toastId = toast.loading(`Uploading image ${i + 1}/${images.length}...`);

          try {
            // Use v2 route to bypass aggressive browser caching
            const uploadResponse = await fetch("/api/upload/image-v2", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });

            const uploadData = await uploadResponse.json();
            toast.dismiss(toastId);

            if (!uploadResponse.ok) {
              const errorType = uploadData.errorType;
              let userMessage = uploadData.error || "Failed to upload image";

              if (errorType === "CONFIG_ERROR") {
                userMessage = "Image uploads temporarily unavailable. Contact support.";
              } else if (errorType === "FILE_TOO_LARGE") {
                userMessage = `Image ${i + 1} is too large. Use images under 10MB.`;
              } else if (errorType === "INVALID_FILE_TYPE") {
                userMessage = `Image ${i + 1} format not supported. Use JPG, PNG, or WebP.`;
              } else if (errorType === "RATE_LIMIT") {
                userMessage = "Too many uploads. Wait a few minutes.";
              }

              throw new Error(userMessage);
            }

            if (uploadData.url) {
              imageUrls.push(uploadData.url);
              toast.success(`Image ${i + 1}/${images.length} uploaded!`, { duration: 1000 });
            } else {
              throw new Error(`Image ${i + 1} uploaded but no URL returned`);
            }
          } catch (error) {
            toast.dismiss(toastId);
            throw error;
          }
        }

        setUploadProgress(null);
      }

      // Create post with multi-platform support
      const toastId = toast.loading("Creating post...");
      const response = await fetch("/api/posts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          mood: "default",
          images: imageUrls,
          platforms: selectedPlatforms,
        }),
      });

      toast.dismiss(toastId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      const result = await response.json();

      // Show success message based on platforms posted to
      const platformsPosted = [];
      if (selectedPlatforms.dragverse) platformsPosted.push("Dragverse");
      if (selectedPlatforms.bluesky && result.bluesky?.success) platformsPosted.push("Bluesky");
      if (selectedPlatforms.farcaster && result.farcaster?.success) platformsPosted.push("Farcaster");

      toast.success(`Post created on ${platformsPosted.join(", ")}! 🎉`);
      setText("");
      setImages([]);
      setPreviews([]);
      setTimeout(() => router.push("/feed"), 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create post";
      setUploadError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setPosting(false);
      setUploadProgress(null);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EB83EA]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#EB83EA] transition mb-4"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to Feed
        </Link>
        <h1 className="text-2xl font-bold">Create Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Text Input */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={300}
            rows={6}
            className="w-full px-4 py-3 bg-[#1a0b2e] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition resize-none"
            disabled={posting}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{text.length}/300</span>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-semibold mb-2 ${
              images.length >= 4 || posting
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:text-[#EB83EA] transition"
            }`}
          >
            <FiImage className="w-5 h-5" />
            Add Images (Max 4)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
              disabled={images.length >= 4 || posting}
            />
          </label>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {previews.map((preview, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden bg-[#0f071a] border border-[#2f2942]"
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                  {!posting && (
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition"
                    >
                      <FiX className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-300">Uploading images...</span>
              <span className="text-sm font-semibold text-blue-300">{uploadProgress.current}/{uploadProgress.total}</span>
            </div>
            <div className="w-full bg-blue-900/30 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Error Display */}
        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-300">{uploadError}</p>
          </div>
        )}

        {/* Platform Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-300">
            Post to:
          </label>
          <div className="space-y-2">
            {/* Dragverse - always checked */}
            <label className="flex items-center gap-3 p-3 bg-[#2f2942] rounded-lg cursor-not-allowed opacity-75">
              <input type="checkbox" checked={true} disabled className="w-4 h-4" />
              <span className="text-sm font-medium">Dragverse</span>
              <span className="ml-auto text-xs text-green-400">Always</span>
            </label>

            {/* Bluesky */}
            <label className={`flex items-center gap-3 p-3 rounded-lg ${
              connectedPlatforms.bluesky ? 'bg-[#2f2942] cursor-pointer hover:bg-[#3f3952]' : 'bg-[#2f2942]/50 cursor-not-allowed'
            }`}>
              <input
                type="checkbox"
                checked={selectedPlatforms.bluesky}
                disabled={!connectedPlatforms.bluesky || posting}
                onChange={(e) => setSelectedPlatforms(prev => ({ ...prev, bluesky: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Bluesky</span>
              <span className="ml-auto text-xs text-gray-400">
                {connectedPlatforms.bluesky ? "Connected" : "Not Connected"}
              </span>
            </label>

            {/* Farcaster */}
            <label className={`flex items-center gap-3 p-3 rounded-lg ${
              connectedPlatforms.farcaster ? 'bg-[#2f2942] cursor-pointer hover:bg-[#3f3952]' : 'bg-[#2f2942]/50 cursor-not-allowed'
            }`}>
              <input
                type="checkbox"
                checked={selectedPlatforms.farcaster}
                disabled={!connectedPlatforms.farcaster || posting}
                onChange={(e) => setSelectedPlatforms(prev => ({ ...prev, farcaster: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Farcaster</span>
              <span className="ml-auto text-xs text-gray-400">
                {connectedPlatforms.farcaster ? "Connected" : "Not Connected"}
              </span>
            </label>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={posting || (!text.trim() && images.length === 0)}
            className="flex-1 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {posting ? "Posting..." : "Post"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={posting}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
