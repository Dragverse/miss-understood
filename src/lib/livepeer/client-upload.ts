/**
 * Client-side Livepeer upload utilities
 * Uses secure backend API routes instead of direct API calls
 */

import * as tus from "tus-js-client";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface LivepeerAsset {
  id: string;
  name: string;
  status: {
    phase: "waiting" | "processing" | "ready" | "failed";
    progress?: number;
  };
  playbackUrl?: string;
  downloadUrl?: string;
  playbackId?: string;
}

/**
 * Upload video file to Livepeer via backend API
 */
export async function uploadVideoToLivepeer(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  authToken?: string | null
): Promise<LivepeerAsset> {
  // Step 1: Request upload URL from our backend
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if token is provided
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
    console.log("✓ Auth token added to upload request");
  } else {
    console.warn("⚠ No auth token provided - upload may fail if authentication is required");
  }

  console.log("Requesting upload URL for:", file.name);

  const uploadUrlResponse = await fetch("/api/upload/request", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: file.name,
    }),
  });

  console.log("Upload URL response status:", uploadUrlResponse.status);

  if (!uploadUrlResponse.ok) {
    // Try to get detailed error message from response
    let errorMessage = "Failed to get upload URL";
    try {
      const errorData = await uploadUrlResponse.json();
      if (errorData.error) {
        errorMessage = errorData.error;
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
      }
    } catch {
      // If JSON parsing fails, use the generic error
      errorMessage = `Failed to get upload URL (${uploadUrlResponse.status})`;
    }
    throw new Error(errorMessage);
  }

  const { tusEndpoint, asset } = await uploadUrlResponse.json();

  // Step 2: Upload file using TUS protocol (direct to Livepeer)
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      uploadSize: file.size,
      chunkSize: 50 * 1024 * 1024, // 50MB chunks for faster upload
      retryDelays: [0, 1000, 3000, 5000], // Retry delays in ms
      parallelUploads: 1, // Sequential for stability
      removeFingerprintOnSuccess: true, // Clean up after success
      onError: (error) => {
        console.error("TUS upload error:", error);

        // Handle specific error codes
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('409')) {
          // Conflict error - upload session already exists
          console.error('❌ Upload conflict (409): Session already exists. This may be a stale upload.');
          reject(new Error('Upload conflict detected. Please try again with a new file or refresh the page.'));
        } else if (errorMessage.includes('500')) {
          // Server error - likely Livepeer storage issue
          console.error('❌ Server error (500): Livepeer storage issue');
          reject(new Error('Server error during upload. Please try again later or contact support if this persists.'));
        } else {
          reject(error);
        }
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) {
          onProgress({
            loaded: bytesUploaded,
            total: bytesTotal,
            percentage: Math.round((bytesUploaded / bytesTotal) * 100),
          });
        }
      },
      onSuccess: () => {
        console.log("✅ TUS upload completed successfully");
        resolve(asset);
      },
    });

    // Start the upload
    upload.start();
  });
}

/**
 * Poll asset status until ready via backend API
 */
export async function waitForAssetReady(
  assetId: string,
  onProgress?: (progress: number) => void
): Promise<LivepeerAsset> {
  const maxAttempts = 120; // 10 minutes (5s intervals)
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`/api/upload/status/${assetId}`);

    if (!response.ok) {
      throw new Error("Failed to get asset status");
    }

    const asset: LivepeerAsset = await response.json();

    if (onProgress && asset.status.progress) {
      onProgress(asset.status.progress);
    }

    if (asset.status.phase === "ready") {
      return asset;
    }

    if (asset.status.phase === "failed") {
      throw new Error("Asset processing failed");
    }

    // Wait 5 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error("Asset processing timeout");
}

/**
 * Get playback URL for an asset
 */
export function getPlaybackUrl(playbackId: string): string {
  return `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
}
