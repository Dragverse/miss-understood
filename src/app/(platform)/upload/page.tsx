"use client";

import { useState, useCallback } from "react";
import { FiUploadCloud, FiCheck, FiFilm, FiZap, FiUpload, FiLoader, FiClock } from "react-icons/fi";
import toast from "react-hot-toast";
import { uploadVideoToLivepeer, waitForAssetReady } from "@/lib/livepeer/client-upload";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { saveLocalVideo } from "@/lib/utils/local-storage";

export default function UploadPage() {
  const { isAuthenticated, signIn, user } = useAuthUser();
  const { getAccessToken, ready } = usePrivy();
  const router = useRouter();

  const [formData, setFormData] = useState({
    contentType: "short" as "short" | "long",
    title: "",
    description: "",
    category: "",
    tags: "",
    visibility: "public" as "public" | "unlisted" | "private",
    thumbnail: null as File | null,
    thumbnailPreview: null as string | null,
    video: null as File | null,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [dragActive, setDragActive] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState<string>("");
  const [uploadedBytes, setUploadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const categories = [
    "Entertainment",
    "Beauty & Makeup",
    "Music",
    "Comedy",
    "Dance",
    "Fashion",
    "Lip Sync",
    "Tutorial",
    "Behind the Scenes",
    "Other",
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateVideoFile = useCallback((file: File, contentType: "short" | "long"): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check file type
      const validTypes = ["video/mp4", "video/webm", "video/x-matroska", "video/quicktime", "video/x-msvideo", "video/avi"];
      if (!validTypes.includes(file.type) && !file.type.startsWith("video/")) {
        toast.error("Invalid file type. Please upload MP4, WebM, MOV, or AVI files.");
        resolve(false);
        return;
      }

      // Check file size (5GB max)
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB in bytes
      if (file.size > maxSize) {
        toast.error("File too large. Maximum size is 5GB.");
        resolve(false);
        return;
      }

      // Check video duration based on content type
      const video = document.createElement("video");
      video.preload = "metadata";

      let metadataLoaded = false;
      let errorOccurred = false;

      video.onloadedmetadata = () => {
        if (errorOccurred) return;
        metadataLoaded = true;

        window.URL.revokeObjectURL(video.src);
        const duration = video.duration; // in seconds

        // Skip duration check if duration is NaN or Infinity (metadata issue)
        if (!isFinite(duration) || duration === 0) {
          console.warn("Could not read video duration, skipping duration validation");
          toast.success("Video file accepted (duration check skipped)");
          resolve(true);
          return;
        }

        if (contentType === "short") {
          // Vertical/Short content: max 20 minutes
          if (duration > 1200) {
            toast.error("Short videos must be 20 minutes or less.");
            resolve(false);
            return;
          }
        } else if (contentType === "long") {
          // Horizontal/Long content: 1 to 60 minutes
          if (duration < 60) {
            toast.error("Long-form videos must be at least 1 minute.");
            resolve(false);
            return;
          }
          if (duration > 3600) {
            toast.error("Long-form videos must be 60 minutes or less.");
            resolve(false);
            return;
          }
        }

        resolve(true);
      };

      video.onerror = (e) => {
        if (metadataLoaded) return;
        errorOccurred = true;

        window.URL.revokeObjectURL(video.src);

        // Be more forgiving - accept the file anyway if it's a valid video MIME type
        // Livepeer will handle the actual transcoding
        console.warn("Could not read video metadata in browser, but file appears to be video format");
        console.error("Video element error:", e);

        toast.success("Video file accepted (browser preview unavailable, but will upload)");
        resolve(true); // Changed from false to true - accept the video anyway
      };

      // Timeout fallback in case metadata never loads
      const timeout = setTimeout(() => {
        if (!metadataLoaded && !errorOccurred) {
          console.warn("Video metadata loading timeout, accepting file anyway");
          window.URL.revokeObjectURL(video.src);
          toast.success("Video file accepted");
          resolve(true);
        }
      }, 5000); // 5 second timeout

      try {
        video.src = URL.createObjectURL(file);
      } catch (error) {
        clearTimeout(timeout);
        console.error("Failed to create object URL:", error);
        toast.error("Failed to process video file. Please try a different file.");
        resolve(false);
      }
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isValid = await validateVideoFile(file, formData.contentType);
      if (isValid) {
        setFormData((prev) => ({ ...prev, video: file }));
      }
    }
  }, [formData.contentType, validateVideoFile]);

  const handleThumbnailChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          thumbnail: file,
          thumbnailPreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData((prev) => ({
        ...prev,
        thumbnail: null,
        thumbnailPreview: null,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ready) {
      toast.error("Please wait, authentication is loading...");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please sign in to upload videos");
      signIn();
      return;
    }

    if (!formData.video) {
      toast.error("Please select a video file");
      return;
    }

    if (!formData.title) {
      toast.error("Please enter a title");
      return;
    }

    if (!formData.category) {
      toast.error("Please select a category");
      return;
    }

    try {
      setUploading(true);
      setUploadStage("uploading");

      // Get Privy auth token for authenticated API calls
      const authToken = await getAccessToken();

      if (!authToken) {
        console.error("[Upload] Failed to get access token");
        toast.error("Authentication failed. Please try signing in again.");
        setUploading(false);
        setUploadStage("idle");
        return;
      }

      let startTime = Date.now();
      let lastUpdate = startTime;
      let lastLoaded = 0;

      const asset = await uploadVideoToLivepeer(
        formData.video,
        (progress) => {
          setUploadProgress(progress.percentage);
          setUploadedBytes(progress.loaded);
          setTotalBytes(progress.total);

          // Calculate upload speed and time remaining
          const now = Date.now();
          const timeDiff = (now - lastUpdate) / 1000; // seconds
          if (timeDiff >= 1) { // Update speed every second
            const bytesDiff = progress.loaded - lastLoaded;
            const speedBps = bytesDiff / timeDiff;
            const speedMBps = speedBps / (1024 * 1024);
            setUploadSpeed(speedMBps.toFixed(2));

            // Calculate time remaining
            const bytesRemaining = progress.total - progress.loaded;
            const secondsRemaining = bytesRemaining / speedBps;
            if (secondsRemaining < 60) {
              setTimeRemaining(`${Math.ceil(secondsRemaining)}s remaining`);
            } else {
              const minutesRemaining = Math.ceil(secondsRemaining / 60);
              setTimeRemaining(`${minutesRemaining} min remaining`);
            }

            lastUpdate = now;
            lastLoaded = progress.loaded;
          }
        },
        authToken
      );

      toast.success("Upload complete! Processing video...");
      setUploadStage("processing");

      const readyAsset = await waitForAssetReady(asset.id, (progress) => {
        setProcessingProgress(Math.round(progress * 100));
      });

      // Save video metadata to Supabase via backend API
      try {

        const metadataResponse = await fetch("/api/video/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            thumbnail: formData.thumbnailPreview || `https://image.lp-playback.studio/image/${readyAsset.playbackId}/thumbnail.webp`,
            livepeerAssetId: readyAsset.id,
            playbackId: readyAsset.playbackId,
            playbackUrl: readyAsset.playbackUrl,
            contentType: formData.contentType,
            category: formData.category,
            tags: formData.tags ? formData.tags.split(",").map((t: string) => t.trim()) : [],
            visibility: formData.visibility,
            _testUserId: user?.id, // Temporary fallback if token auth fails
          }),
        });

        const metadataResult = await metadataResponse.json();

        if (!metadataResponse.ok) {
          console.error("[Upload] Metadata save failed:", metadataResult.error);
          throw new Error(metadataResult.error || "Failed to save video metadata");
        }

        // If in fallback mode, store video data in localStorage
        if (metadataResult.fallbackMode && metadataResult.videoData) {
          saveLocalVideo(metadataResult.videoData);
        }

        setUploadStage("complete");

        // Show appropriate success message based on mode
        if (metadataResult.fallbackMode) {
          toast.success("Video uploaded! (Saved locally - will sync when available)");
        } else {
          toast.success("Video uploaded successfully!");
        }
      } catch (metadataError) {
        console.error("[Upload] Metadata save error:", metadataError);
        toast.error("Video uploaded but metadata save failed");
        setUploadStage("complete");
      }

      // Redirect to dashboard after successful upload
      setTimeout(() => {
        setFormData({
          contentType: "short",
          title: "",
          description: "",
          category: "",
          tags: "",
          visibility: "public",
          thumbnail: null,
          thumbnailPreview: null,
          video: null,
        });
        setUploadStage("idle");
        setUploadProgress(0);
        setProcessingProgress(0);
        setUploading(false);
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("[Upload] Error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
      setUploading(false);
      setUploadStage("idle");
      setUploadProgress(0);
      setProcessingProgress(0);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center">
            <FiUploadCloud className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Upload Your Content</h1>
          <p className="text-gray-400">
            Sign in to share your drag content with the community
          </p>
          <button
            onClick={signIn}
            className="px-8 py-3 bg-[#EB83EA] hover:bg-[#E748E6] text-white rounded-full font-semibold transition-colors"
          >
            Sign In to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Content</h1>
        <p className="text-gray-400">
          Share your drag content with the Dragverse community
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Content Type Toggle */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
          <label className="block text-lg font-bold uppercase tracking-widest mb-4">
            Content Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, contentType: "short" })}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.contentType === "short"
                  ? "border-[#EB83EA] bg-[#EB83EA]/10"
                  : "border-[#2f2942] hover:border-[#EB83EA]/50"
              }`}
            >
              <FiZap className={`w-8 h-8 ${formData.contentType === "short" ? "text-[#EB83EA]" : "text-gray-400"}`} />
              <div className="text-center">
                <div className="font-bold">Byte</div>
                <div className="text-xs text-gray-400">Vertical - Max 20 minutes</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, contentType: "long" })}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.contentType === "long"
                  ? "border-[#EB83EA] bg-[#EB83EA]/10"
                  : "border-[#2f2942] hover:border-[#EB83EA]/50"
              }`}
            >
              <FiFilm className={`w-8 h-8 ${formData.contentType === "long" ? "text-[#EB83EA]" : "text-gray-400"}`} />
              <div className="text-center">
                <div className="font-bold">Video</div>
                <div className="text-xs text-gray-400">Horizontal - 1 to 60 minutes</div>
              </div>
            </button>
          </div>
        </div>

        {/* Video Upload */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
          <label className="block text-lg font-bold uppercase tracking-widest mb-4">
            Video File
          </label>
          <label
            className={`flex flex-col items-center justify-center w-full px-6 py-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              dragActive
                ? "border-[#EB83EA] bg-[#EB83EA]/10"
                : formData.video
                ? "border-green-500/50 bg-green-500/5"
                : "border-[#2f2942] hover:border-[#EB83EA]/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {formData.video ? (
              <div className="text-center">
                <FiCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <span className="text-lg font-semibold text-green-500">
                  {formData.video.name}
                </span>
                <p className="text-sm text-gray-400 mt-1">
                  {(formData.video.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFormData({ ...formData, video: null });
                  }}
                  className="mt-3 text-sm text-[#EB83EA] hover:underline"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center mb-4">
                  <FiUploadCloud className="w-8 h-8 text-[#EB83EA]" />
                </div>
                <span className="text-lg font-semibold">
                  Drag and drop or click to upload
                </span>
                <span className="text-sm text-gray-400 mt-2">
                  MP4, WebM, MKV - Max 5GB
                </span>
              </>
            )}
            <input
              type="file"
              accept="video/mp4,video/webm,video/x-matroska,video/quicktime,video/x-msvideo,video/avi,video/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const isValid = await validateVideoFile(file, formData.contentType);
                  if (isValid) {
                    setFormData({
                      ...formData,
                      video: file,
                    });
                  }
                }
              }}
              className="hidden"
            />
          </label>
        </div>

        {/* Details */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942] space-y-6">
          <h2 className="text-lg font-bold uppercase tracking-widest">Details</h2>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              maxLength={100}
              placeholder="Give your content a catchy title..."
              className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {formData.title.length}/100
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              maxLength={5000}
              placeholder="Tell viewers about your content..."
              rows={4}
              className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition resize-none placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {formData.description.length}/5000
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition text-white"
            >
              <option value="" className="bg-[#1a0b2e]">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1a0b2e]">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="drag, makeup, performance (comma separated)"
              className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition placeholder:text-gray-500"
            />
          </div>

          {/* Privacy/Visibility */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-300">
              Privacy *
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 bg-[#0f071a] border border-[#2f2942] rounded-xl cursor-pointer hover:border-[#EB83EA]/50 transition">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={formData.visibility === "public"}
                  onChange={(e) =>
                    setFormData({ ...formData, visibility: e.target.value as "public" | "unlisted" | "private" })
                  }
                  className="mt-1 accent-[#EB83EA]"
                />
                <div>
                  <div className="font-semibold text-white">Public</div>
                  <div className="text-sm text-gray-400">
                    Anyone can search for and view your video
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-4 bg-[#0f071a] border border-[#2f2942] rounded-xl cursor-pointer hover:border-[#EB83EA]/50 transition">
                <input
                  type="radio"
                  name="visibility"
                  value="unlisted"
                  checked={formData.visibility === "unlisted"}
                  onChange={(e) =>
                    setFormData({ ...formData, visibility: e.target.value as "public" | "unlisted" | "private" })
                  }
                  className="mt-1 accent-[#EB83EA]"
                />
                <div>
                  <div className="font-semibold text-white">Unlisted</div>
                  <div className="text-sm text-gray-400">
                    Only people with the link can view your video
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-4 bg-[#0f071a] border border-[#2f2942] rounded-xl cursor-pointer hover:border-[#EB83EA]/50 transition">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={formData.visibility === "private"}
                  onChange={(e) =>
                    setFormData({ ...formData, visibility: e.target.value as "public" | "unlisted" | "private" })
                  }
                  className="mt-1 accent-[#EB83EA]"
                />
                <div>
                  <div className="font-semibold text-white">Private</div>
                  <div className="text-sm text-gray-400">
                    Only you can view your video (share with invite links)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Thumbnail */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
          <label className="block text-lg font-bold uppercase tracking-widest mb-4">
            Thumbnail (Optional)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed border-[#2f2942] rounded-2xl hover:border-[#EB83EA]/50 cursor-pointer transition">
              <FiUploadCloud className="w-8 h-8 text-[#EB83EA] mb-2" />
              <span className="text-sm font-medium">
                {formData.thumbnail ? formData.thumbnail.name : "Upload thumbnail"}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                PNG, JPG - 1280x720px recommended
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {formData.thumbnailPreview && (
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <Image
                  src={formData.thumbnailPreview}
                  alt="Thumbnail preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleThumbnailChange(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
                >
                  x
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3 p-4 bg-[#1a0b2e] border border-[#2f2942] rounded-2xl">
          <input
            type="checkbox"
            id="terms"
            required
            className="mt-1 w-5 h-5 accent-[#EB83EA] rounded"
          />
          <label htmlFor="terms" className="text-sm text-gray-300">
            I confirm this content follows community guidelines and I have the rights to share it.
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || !formData.video || !formData.title || !formData.category}
          className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors text-lg"
        >
          {uploading ? "Uploading..." : "Upload Content"}
        </button>

        {/* Upload Progress - Fixed Bottom Right Popup */}
        {uploading && (
          <div className="fixed bottom-6 right-6 w-[420px] p-6 bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] border-2 border-[#EB83EA]/30 rounded-[20px] shadow-2xl shadow-[#EB83EA]/20 backdrop-blur-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
            {uploadStage === "uploading" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EB83EA]/20 flex items-center justify-center">
                      <FiUpload className="text-lg text-[#EB83EA] animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        {totalBytes > 500 * 1024 * 1024 ? "Hang tight! Large file uploading..." :
                         totalBytes > 200 * 1024 * 1024 ? "Uploading Video..." :
                         "Almost there!"}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {uploadSpeed && `${uploadSpeed} MB/s • `}
                        {(uploadedBytes / (1024 * 1024)).toFixed(0)} / {(totalBytes / (1024 * 1024)).toFixed(0)} MB
                        {timeRemaining && ` • ${timeRemaining}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-[#0f071a] rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-[#EB83EA] via-[#B86DE5] to-[#7c3aed] h-3 rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
              </div>
            )}

            {uploadStage === "processing" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EB83EA]/20 flex items-center justify-center">
                      <FiLoader className="text-lg text-[#EB83EA] animate-spin" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Processing Video</h3>
                      <p className="text-xs text-gray-400">Optimizing for streaming...</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
                    {processingProgress}%
                  </span>
                </div>
                <div className="w-full bg-[#0f071a] rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-[#EB83EA] via-[#B86DE5] to-[#7c3aed] h-3 rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${processingProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <FiClock className="text-[#EB83EA]" />
                  This may take a few minutes
                </p>
              </div>
            )}

            {uploadStage === "complete" && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <FiCheck className="text-2xl text-green-500 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-green-500">Upload Complete!</h3>
                  <p className="text-xs text-gray-400">Redirecting to your video...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
