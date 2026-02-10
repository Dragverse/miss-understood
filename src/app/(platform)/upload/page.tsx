"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { FiUploadCloud, FiCheck, FiFilm, FiZap, FiUpload, FiLoader, FiClock, FiMusic, FiMic } from "react-icons/fi";
import toast from "react-hot-toast";
import { uploadVideoToLivepeer, waitForAssetReady } from "@/lib/livepeer/client-upload";
import { useAuthUser } from "@/lib/privy/hooks";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { saveLocalVideo } from "@/lib/utils/local-storage";
import { getVideo } from "@/lib/supabase/videos";
import { transformVideoWithCreator } from "@/lib/supabase/transform-video";
import imageCompression from "browser-image-compression";
import { FarcasterIcon } from "@/components/profile/farcaster-badge";

function UploadPageContent() {
  const { isAuthenticated, signIn, user } = useAuthUser();
  const { getAccessToken, ready } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const typeParam = searchParams.get("type"); // Get type from URL (e.g., ?type=audio)

  // Auto-select media type based on URL parameter
  const initialMediaType = typeParam === "audio" ? "audio" : "video";
  const initialContentType = typeParam === "audio" ? "podcast" : "short";

  const [formData, setFormData] = useState({
    mediaType: initialMediaType as "video" | "audio",
    contentType: initialContentType as "short" | "long" | "podcast" | "music",
    title: "",
    description: "",
    category: "",
    tags: "",
    visibility: "public" as "public" | "unlisted" | "private",
    thumbnail: null as File | null,
    thumbnailPreview: null as string | null,
    video: null as File | null,
    crossPostBluesky: false,
    crossPostFarcaster: false,
  });

  const [connectedPlatforms, setConnectedPlatforms] = useState({
    bluesky: false,
    farcaster: false,
  });
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

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

  // Load existing video data if editing
  useEffect(() => {
    if (editId && user) {
      loadVideoForEdit();
    }

    async function loadVideoForEdit() {
      try {
        const videoDoc = await getVideo(editId!);
        if (!videoDoc) {
          toast.error("Video not found");
          router.push("/upload");
          return;
        }

        const video = await transformVideoWithCreator(videoDoc);

        // Check if user owns this video
        if (video.creator?.did !== user?.id) {
          toast.error("You don't have permission to edit this video");
          router.push("/upload");
          return;
        }

        // Determine media type from content type
        const mediaType = video.contentType === 'podcast' || video.contentType === 'music' ? 'audio' : 'video';

        // Populate form with existing data
        setFormData({
          mediaType,
          contentType: video.contentType as any,
          title: video.title,
          description: video.description || "",
          category: video.category || "",
          tags: video.tags?.join(", ") || "",
          visibility: video.visibility || "public",
          thumbnail: null,
          thumbnailPreview: video.thumbnail || null,
          video: null, // Don't load the actual file
          crossPostBluesky: false, // Don't cross-post when editing
          crossPostFarcaster: false, // Don't cross-post when editing
        });

        toast.success("Loaded video data for editing");
      } catch (error) {
        console.error("Failed to load video for edit:", error);
        toast.error("Failed to load video data");
      }
    }
  }, [editId, user, router]);

  // Load crosspost connection status
  useEffect(() => {
    async function loadConnectionStatus() {
      if (!isAuthenticated || !ready) {
        setIsLoadingConnections(false);
        return;
      }

      try {
        const token = await getAccessToken();
        const response = await fetch("/api/user/crosspost-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setConnectedPlatforms(data.connected);

            // Auto-enable crosspost for connected platforms with saved preferences
            setFormData((prev) => ({
              ...prev,
              crossPostBluesky:
                data.connected.bluesky && data.settings.bluesky,
              crossPostFarcaster:
                data.connected.farcaster && data.settings.farcaster,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load connection status:", error);
      } finally {
        setIsLoadingConnections(false);
      }
    }

    loadConnectionStatus();
  }, [isAuthenticated, ready, getAccessToken]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateMediaFile = useCallback((file: File, mediaType: "video" | "audio", contentType: "short" | "long" | "podcast" | "music"): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check file type based on media type
      if (mediaType === "video") {
        const validTypes = ["video/mp4", "video/webm", "video/x-matroska", "video/quicktime", "video/x-msvideo", "video/avi"];
        if (!validTypes.includes(file.type) && !file.type.startsWith("video/")) {
          toast.error("Invalid file type. Please upload MP4, WebM, MOV, or AVI files.");
          resolve(false);
          return;
        }
      } else if (mediaType === "audio") {
        const validAudioTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac", "audio/flac", "audio/mp3", "audio/x-m4a", "audio/mpeg3", "audio/x-mpeg-3"];
        if (!validAudioTypes.includes(file.type) && !file.type.startsWith("audio/")) {
          toast.error("Invalid audio type. Please upload MP3, WAV, OGG, AAC, or FLAC files.");
          resolve(false);
          return;
        }
      }

      // Check file size (5GB max for video, 500MB max for audio)
      const maxSize = mediaType === "video" ? 5 * 1024 * 1024 * 1024 : 500 * 1024 * 1024; // 5GB for video, 500MB for audio
      if (file.size > maxSize) {
        toast.error(`File too large. Maximum size is ${mediaType === "video" ? "5GB" : "500MB"}.`);
        resolve(false);
        return;
      }

      // Check duration based on media type
      if (mediaType === "audio") {
        // For audio, skip duration validation as browsers may not read audio metadata
        // File size limit is sufficient for audio files
        toast.success("Audio file accepted");
        resolve(true);
        return;
      }

      // Video duration validation
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

  // Extract first frame from video as thumbnail
  const extractFirstFrame = useCallback(async (videoFile: File): Promise<File | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true; // Mute to avoid audio playback

        video.onloadeddata = () => {
          try {
            // Seek to 1 second (or 0.5s for shorts) to get a better frame than the first black frame
            video.currentTime = 1;
          } catch (error) {
            console.warn("Could not seek video, using first frame:", error);
            video.currentTime = 0;
          }
        };

        video.onseeked = () => {
          try {
            // Create canvas with video dimensions
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              console.error("Could not get canvas context");
              resolve(null);
              return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob (JPEG at 90% quality)
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // Create a File object from the blob
                  const thumbnailFile = new File([blob], "thumbnail.jpg", {
                    type: "image/jpeg",
                  });
                  console.log("[Upload] Extracted thumbnail from video:", {
                    size: `${(blob.size / 1024).toFixed(1)}KB`,
                    dimensions: `${canvas.width}x${canvas.height}`,
                  });
                  resolve(thumbnailFile);
                } else {
                  console.error("Failed to create thumbnail blob");
                  resolve(null);
                }
                URL.revokeObjectURL(video.src);
              },
              "image/jpeg",
              0.9
            );
          } catch (error) {
            console.error("Error extracting video frame:", error);
            URL.revokeObjectURL(video.src);
            resolve(null);
          }
        };

        video.onerror = (error) => {
          console.error("Error loading video for thumbnail:", error);
          URL.revokeObjectURL(video.src);
          resolve(null);
        };

        video.src = URL.createObjectURL(videoFile);
      } catch (error) {
        console.error("Error in extractFirstFrame:", error);
        resolve(null);
      }
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isValid = await validateMediaFile(file, formData.mediaType, formData.contentType);
      if (isValid) {
        setFormData((prev) => ({ ...prev, video: file }));

        // Auto-extract first frame as thumbnail for videos
        if (formData.mediaType === "video" && !formData.thumbnail) {
          toast("Extracting thumbnail from video...");
          const thumbnailFile = await extractFirstFrame(file);
          if (thumbnailFile) {
            // Create preview URL
            const previewUrl = URL.createObjectURL(thumbnailFile);
            setFormData((prev) => ({
              ...prev,
              thumbnail: thumbnailFile,
              thumbnailPreview: previewUrl,
            }));
            toast.success("Thumbnail extracted!");
          }
        }
      }
    }
  }, [formData.mediaType, formData.contentType, formData.thumbnail, validateMediaFile, extractFirstFrame]);

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

  const handleUpdate = async () => {
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
      const authToken = await getAccessToken();

      if (!authToken) {
        toast.error("Authentication failed. Please try signing in again.");
        setUploading(false);
        return;
      }

      // If user uploaded a new thumbnail, upload it to Livepeer
      let thumbnailUrl = formData.thumbnailPreview;

      if (formData.thumbnail) {
        toast("Uploading new thumbnail...");
        try {
          // Compress image before uploading to avoid 413 errors
          let thumbnailToUpload = formData.thumbnail;

          // Only compress if file is larger than 1MB
          if (formData.thumbnail.size > 1024 * 1024) {
            toast("Compressing image...");
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
              fileType: formData.thumbnail.type as any,
            };

            try {
              thumbnailToUpload = await imageCompression(formData.thumbnail, options);
              console.log(`[Upload] Compressed thumbnail from ${(formData.thumbnail.size / 1024 / 1024).toFixed(2)}MB to ${(thumbnailToUpload.size / 1024 / 1024).toFixed(2)}MB`);
            } catch (compressError) {
              console.warn("[Upload] Failed to compress image, uploading original:", compressError);
              // Continue with original file if compression fails
            }
          }

          // Upload thumbnail as an image using the image upload API
          const thumbnailFormData = new FormData();
          thumbnailFormData.append("file", thumbnailToUpload);

          const uploadResponse = await fetch("/api/upload/image-v2", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            body: thumbnailFormData,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload thumbnail image");
          }

          const uploadResult = await uploadResponse.json();
          if (uploadResult.success && uploadResult.url) {
            thumbnailUrl = uploadResult.url;
            toast.success("Thumbnail uploaded successfully");
          } else {
            throw new Error("Invalid upload response");
          }
        } catch (error) {
          console.error("Failed to upload thumbnail:", error);
          toast.error("Failed to upload new thumbnail. Keeping existing thumbnail.");
          // Keep the existing thumbnail if upload fails
          thumbnailUrl = formData.thumbnailPreview;
        }
      }

      // Only send thumbnail URL if it's a valid HTTP(S) URL, not a base64 string
      const updatePayload: any = {
        videoId: editId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags ? formData.tags.split(",").map((t: string) => t.trim()) : [],
        visibility: formData.visibility,
      };

      // Only include thumbnail if it's a new upload (HTTP URL)
      if (thumbnailUrl && (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'))) {
        updatePayload.thumbnail = thumbnailUrl;
      }

      const response = await fetch("/api/video/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update video");
      }

      toast.success("Video updated successfully!");
      router.push("/profile");
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update video");
    } finally {
      setUploading(false);
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

    // Validate terms checkbox
    const termsCheckbox = document.querySelector('#terms') as HTMLInputElement;
    if (!termsCheckbox?.checked) {
      toast.error("Please confirm that you have the rights to share this content");
      return;
    }

    // If editing, allow updating without a video file
    if (editId) {
      return handleUpdate();
    }

    if (!formData.video) {
      toast.error(`Please select a ${formData.mediaType} file`);
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

      const startTime = Date.now();
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

      toast.success(`Upload complete! Processing ${formData.mediaType}...`);
      setUploadStage("processing");

      const readyAsset = await waitForAssetReady(asset.id, (progress) => {
        setProcessingProgress(Math.round(progress * 100));
      });

      const mediaLabel = formData.mediaType === 'video' ? 'Video' : 'Audio';
      toast.success(`${mediaLabel} processing complete! 🎉`);

      // Save video metadata to Supabase via backend API
      try {
        // Upload extracted thumbnail to Supabase if exists
        let thumbnailUrl: string | null = null;

        if (formData.thumbnail) {
          toast("Uploading thumbnail...");
          try {
            let thumbnailToUpload = formData.thumbnail;

            // Compress if > 1MB (same logic as update function)
            if (formData.thumbnail.size > 1024 * 1024) {
              console.log("[Upload] Compressing thumbnail...");
              const imageCompression = (await import("browser-image-compression")).default;
              thumbnailToUpload = await imageCompression(formData.thumbnail, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
              });
              console.log("[Upload] Thumbnail compressed:", {
                originalSize: `${(formData.thumbnail.size / 1024).toFixed(1)}KB`,
                compressedSize: `${(thumbnailToUpload.size / 1024).toFixed(1)}KB`,
              });
            }

            // Upload to Supabase Storage
            const thumbnailFormData = new FormData();
            thumbnailFormData.append("file", thumbnailToUpload);

            const uploadResponse = await fetch("/api/upload/image-v2", {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}` },
              body: thumbnailFormData,
            });

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              if (uploadResult.success && uploadResult.url) {
                thumbnailUrl = uploadResult.url;
                console.log("[Upload] Thumbnail uploaded to Supabase:", thumbnailUrl);
                toast.success("Thumbnail uploaded!");
              }
            } else {
              const errorText = await uploadResponse.text();
              console.error("[Upload] Thumbnail upload failed:", errorText);
              toast.error("Thumbnail upload failed. Using default thumbnail.");
            }
          } catch (error) {
            console.error("[Upload] Thumbnail upload error:", error);
            toast.error("Thumbnail upload error. Using default thumbnail.");
          }
        }

        // Don't store Livepeer URLs - let getSafeThumbnail() generate them dynamically
        // This prevents storing URLs that might return 502 errors if thumbnail isn't ready
        if (!thumbnailUrl) {
          console.log("[Upload] No thumbnail uploaded - will use dynamic Livepeer fallback");
        }

        const metadataResponse = await fetch("/api/video/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            thumbnail: thumbnailUrl,
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
          toast.error(
            "Video uploaded but couldn't save to cloud. It's stored locally. Please check your connection.",
            { duration: 10000 }
          );
          // TODO: Implement sync retry mechanism
        } else {
          const mediaLabel = formData.mediaType === 'video' ? 'Video' : 'Audio';
          toast.success(`${mediaLabel} uploaded successfully!`);

          // Create feed post (which also handles crossposting automatically)
          console.log("[Upload] Metadata result:", metadataResult);
          console.log("[Upload] Video ID:", metadataResult.videoId);
          console.log("[Upload] Crosspost settings:", {
            bluesky: formData.crossPostBluesky,
            farcaster: formData.crossPostFarcaster
          });

          if (metadataResult.videoId) {
            try {
              console.log("[Upload] Creating feed post...");
              toast("Creating feed post...");

              const token = await getAccessToken();
              console.log("[Upload] Got access token:", token ? "✓" : "✗");

              const videoUrl = `${window.location.origin}/${formData.mediaType === 'audio' ? 'listen' : 'watch'}/${metadataResult.videoId}`;

              // Create post text with title, description, and link
              const postText = `${formData.title}${formData.description ? `\n\n${formData.description}` : ''}\n\n${formData.mediaType === 'video' ? '🎬' : '🎵'} ${videoUrl}`;

              // Use thumbnail or default (use production URL for crossposting compatibility)
              const postThumbnail = thumbnailUrl || 'https://www.dragverse.app/default-thumbnail.jpg';

              console.log("[Upload] Feed post data:", {
                textContent: postText.substring(0, 50) + "...",
                mediaUrls: [postThumbnail],
                platforms: {
                  dragverse: true,
                  bluesky: formData.crossPostBluesky,
                  farcaster: formData.crossPostFarcaster,
                }
              });

              const feedPostResponse = await fetch("/api/posts/create", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  textContent: postText,
                  mediaUrls: [postThumbnail],
                  mediaTypes: ["image"],
                  visibility: formData.visibility,
                  platforms: {
                    dragverse: true,
                    bluesky: formData.crossPostBluesky,
                    farcaster: formData.crossPostFarcaster,
                  },
                }),
              });

              console.log("[Upload] Feed post response status:", feedPostResponse.status);

              if (feedPostResponse.ok) {
                const feedData = await feedPostResponse.json();
                console.log("[Upload] Feed post created:", feedData);
                toast.success("Posted to Dragverse feed!");

                // Handle crosspost results
                console.log("[Upload] Crosspost results:", feedData.crosspost);

                if (feedData.crosspost?.bluesky?.success) {
                  console.log("[Upload] ✅ Bluesky success:", feedData.crosspost.bluesky);
                  toast.success("Shared to Bluesky!");
                } else if (feedData.crosspost?.bluesky?.error) {
                  console.error("[Upload] ❌ Bluesky failed:", feedData.crosspost.bluesky.error);
                  toast.error(`Bluesky: ${feedData.crosspost.bluesky.error}`);
                }

                if (feedData.crosspost?.farcaster?.success) {
                  console.log("[Upload] ✅ Farcaster success:", feedData.crosspost.farcaster);
                  toast.success("Shared to Farcaster /dragverse!");
                } else if (feedData.crosspost?.farcaster?.error) {
                  console.error("[Upload] ❌ Farcaster failed:", feedData.crosspost.farcaster.error);
                  toast.error(`Farcaster: ${feedData.crosspost.farcaster.error}`);
                }
              } else {
                const error = await feedPostResponse.json();
                console.error("[Upload] ❌ Feed post API error:", error);
                toast.error(`Couldn't create feed post: ${error.error || "Unknown error"}`);
              }
            } catch (feedPostError) {
              console.error("[Upload] ❌ Feed post exception:", feedPostError);
              toast.error("Couldn't create feed post. Your upload was saved.");
            }
          } else {
            console.warn("[Upload] ⚠️ No video ID in metadata result, skipping feed post creation");
            console.warn("[Upload] Full metadata result:", metadataResult);
          }
        }
      } catch (metadataError) {
        console.error("[Upload] Metadata save error:", metadataError);
        toast.error("Video uploaded but metadata save failed");
        setUploadStage("complete");
      }

      // Redirect to dashboard after successful upload
      setTimeout(() => {
        setFormData({
          mediaType: "video",
          contentType: "short",
          title: "",
          description: "",
          category: "",
          tags: "",
          visibility: "public",
          thumbnail: null,
          thumbnailPreview: null,
          video: null,
          crossPostBluesky: false,
          crossPostFarcaster: false,
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
        <h1 className="text-3xl font-bold mb-2">{editId ? "Edit Content" : "Upload Content"}</h1>
        <p className="text-gray-400">
          {editId ? "Update your content details and thumbnail" : "Share your drag content with the Dragverse community"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Media Type Toggle */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
          <label className="block text-lg font-bold uppercase tracking-widest mb-4">
            Media Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, mediaType: "video", contentType: "short", video: null })}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.mediaType === "video"
                  ? "border-[#EB83EA] bg-[#EB83EA]/10"
                  : "border-[#2f2942] hover:border-[#EB83EA]/50"
              }`}
            >
              <FiFilm className={`w-8 h-8 ${formData.mediaType === "video" ? "text-[#EB83EA]" : "text-gray-400"}`} />
              <div className="text-center">
                <div className="font-bold">Video</div>
                <div className="text-xs text-gray-400">Short or long-form video content</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, mediaType: "audio", contentType: "podcast", video: null })}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.mediaType === "audio"
                  ? "border-[#EB83EA] bg-[#EB83EA]/10"
                  : "border-[#2f2942] hover:border-[#EB83EA]/50"
              }`}
            >
              <FiMusic className={`w-8 h-8 ${formData.mediaType === "audio" ? "text-[#EB83EA]" : "text-gray-400"}`} />
              <div className="text-center">
                <div className="font-bold">Audio</div>
                <div className="text-xs text-gray-400">Music or podcast content</div>
              </div>
            </button>
          </div>
        </div>

        {/* Content Type Toggle */}
        <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
          <label className="block text-lg font-bold uppercase tracking-widest mb-4">
            Content Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            {formData.mediaType === "video" ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contentType: "podcast" })}
                  className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                    formData.contentType === "podcast"
                      ? "border-[#EB83EA] bg-[#EB83EA]/10"
                      : "border-[#2f2942] hover:border-[#EB83EA]/50"
                  }`}
                >
                  <FiMic className={`w-8 h-8 ${formData.contentType === "podcast" ? "text-[#EB83EA]" : "text-gray-400"}`} />
                  <div className="text-center">
                    <div className="font-bold">Podcast</div>
                    <div className="text-xs text-gray-400">Spoken word, interviews, discussions</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contentType: "music" })}
                  className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                    formData.contentType === "music"
                      ? "border-[#EB83EA] bg-[#EB83EA]/10"
                      : "border-[#2f2942] hover:border-[#EB83EA]/50"
                  }`}
                >
                  <FiMusic className={`w-8 h-8 ${formData.contentType === "music" ? "text-[#EB83EA]" : "text-gray-400"}`} />
                  <div className="text-center">
                    <div className="font-bold">Music</div>
                    <div className="text-xs text-gray-400">Songs, performances, audio tracks</div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Media Upload */}
        {!editId && (
          <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
            <label className="block text-lg font-bold uppercase tracking-widest mb-4">
              {formData.mediaType === "video" ? "Video File" : "Audio File"}
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
                  {formData.mediaType === "video" ? "MP4, WebM, MKV - Max 5GB" : "MP3, WAV, OGG, FLAC - Max 500MB"}
                </span>
              </>
            )}
            <input
              type="file"
              accept={
                formData.mediaType === "video"
                  ? "video/mp4,video/webm,video/x-matroska,video/quicktime,video/x-msvideo,video/avi,video/*"
                  : "audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/flac,audio/mp3,audio/x-m4a,audio/*"
              }
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const isValid = await validateMediaFile(file, formData.mediaType, formData.contentType);
                  if (isValid) {
                    setFormData({
                      ...formData,
                      video: file,
                    });

                    // Auto-extract first frame as thumbnail for videos
                    if (formData.mediaType === "video" && !formData.thumbnail) {
                      toast("Extracting thumbnail from video...");
                      const thumbnailFile = await extractFirstFrame(file);
                      if (thumbnailFile) {
                        // Create preview URL
                        const previewUrl = URL.createObjectURL(thumbnailFile);
                        setFormData((prev) => ({
                          ...prev,
                          thumbnail: thumbnailFile,
                          thumbnailPreview: previewUrl,
                        }));
                        toast.success("Thumbnail extracted!");
                      }
                    }
                  }
                }
              }}
              className="hidden"
            />
          </label>
          </div>
        )}

        {/* Edit mode message */}
        {editId && (
          <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
            <p className="text-gray-400 text-center">
              Media file cannot be changed when editing. Upload a new file to create a new post.
            </p>
          </div>
        )}

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
          <div className="mb-4">
            <label className="block text-lg font-bold uppercase tracking-widest flex items-center gap-2">
              {editId ? "Cover Image (Click to change)" : "Cover Image"}
              {!editId && (
                <span className="text-xs font-normal px-2 py-1 bg-[#EB83EA]/20 text-[#EB83EA] rounded-full">
                  Recommended
                </span>
              )}
            </label>
            {!editId && (
              <p className="text-sm mt-2">
                <span className="text-[#EB83EA] font-semibold">⚠️ Custom thumbnails get 3x more clicks!</span>
                <span className="text-gray-400"> Upload your own or we'll use a default cover image.</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed border-[#EB83EA]/30 rounded-2xl hover:border-[#EB83EA] hover:bg-[#EB83EA]/5 cursor-pointer transition-all">
              <FiUploadCloud className="w-8 h-8 text-[#EB83EA] mb-2" />
              <span className="text-sm font-semibold text-[#EB83EA]">
                {formData.thumbnail ? formData.thumbnail.name : "Click to Upload Thumbnail"}
              </span>
              <span className="text-xs text-gray-400 mt-1">
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

        {/* Cross-Post to Bluesky - Only show for new uploads (not edits) */}
        {!editId && formData.visibility === "public" && (
          <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
            <label className="block text-lg font-bold uppercase tracking-widest mb-4">
              Share to Social
            </label>
            <label className={`flex items-start gap-3 p-4 bg-[#0f071a] border border-[#2f2942] rounded-xl ${!connectedPlatforms.bluesky || isLoadingConnections ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#0085ff]/50'} transition`}>
              <input
                type="checkbox"
                checked={formData.crossPostBluesky}
                onChange={(e) => setFormData({ ...formData, crossPostBluesky: e.target.checked })}
                disabled={!connectedPlatforms.bluesky || isLoadingConnections}
                className="mt-1 w-5 h-5 accent-[#0085ff] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#0085ff]" viewBox="0 0 568 501" fill="currentColor">
                    <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 googletag 383.039C285.169 375.812 284.017 372.431 284 375.306C283.983 372.431 282.831 375.812 280.369 383.039C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0535 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1345 -1.61183 123.121 33.6637Z"/>
                  </svg>
                  <span className="font-semibold text-white">Cross-post to Bluesky</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Share a link to this video on your connected Bluesky account
                </p>
                {!connectedPlatforms.bluesky && !isLoadingConnections && (
                  <p className="text-sm text-red-400 mt-2">
                    Not connected -{" "}
                    <Link href="/settings" className="underline hover:text-red-300">
                      connect in Settings
                    </Link>
                  </p>
                )}
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 bg-[#0f071a] border border-[#2f2942] rounded-xl ${!connectedPlatforms.farcaster || isLoadingConnections ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-500/50'} transition mt-3`}>
              <input
                type="checkbox"
                checked={formData.crossPostFarcaster}
                onChange={(e) => setFormData({ ...formData, crossPostFarcaster: e.target.checked })}
                disabled={!connectedPlatforms.farcaster || isLoadingConnections}
                className="mt-1 w-5 h-5 accent-purple-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FarcasterIcon className="w-5 h-5" />
                  <span className="font-semibold text-white">Cross-post to Farcaster</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Share this video to /dragverse channel on your connected Farcaster account
                </p>
                {!connectedPlatforms.farcaster && !isLoadingConnections && (
                  <p className="text-sm text-red-400 mt-2">
                    Not connected -{" "}
                    <Link href="/settings" className="underline hover:text-red-300">
                      connect in Settings
                    </Link>
                  </p>
                )}
              </div>
            </label>
          </div>
        )}

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
          disabled={uploading || (!editId && !formData.video) || !formData.title || !formData.category}
          className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors text-lg"
        >
          {uploading ? (editId ? "Updating..." : "Uploading...") : (editId ? "Update Content" : "Upload Content")}
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
                      <h3 className="font-bold text-lg">
                        Processing {formData.mediaType === 'video' ? 'Video' : 'Audio'}
                      </h3>
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

export default function UploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <UploadPageContent />
    </Suspense>
  );
}
