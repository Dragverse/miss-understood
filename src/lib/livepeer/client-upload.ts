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
 * Clear all stale TUS upload sessions from localStorage
 * This prevents 409 Conflict errors from previous interrupted uploads
 */
function clearStaleTusFingerprints() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tus::') || key.includes('livepeer'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleared stale TUS fingerprint:', key);
    });
    if (keysToRemove.length > 0) {
      console.log(`✅ Cleared ${keysToRemove.length} stale TUS fingerprint(s)`);
    }
  } catch (e) {
    console.warn('Failed to clear TUS fingerprints:', e);
  }
}

/**
 * Upload video file to Livepeer via backend API
 */
export async function uploadVideoToLivepeer(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  authToken?: string | null
): Promise<LivepeerAsset> {
  // Clear any stale TUS fingerprints to prevent 409 conflicts
  clearStaleTusFingerprints();

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

  // Create AbortController for fetch timeout
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for request

  let tusEndpoint: string;
  let asset: LivepeerAsset;

  try {
    const uploadUrlResponse = await fetch("/api/upload/request", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: file.name,
      }),
      signal: controller.signal,
    });

    clearTimeout(fetchTimeout);
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

    const response = await uploadUrlResponse.json();
    tusEndpoint = response.tusEndpoint;
    asset = response.asset;
  } catch (error: any) {
    clearTimeout(fetchTimeout);
    if (error.name === 'AbortError') {
      throw new Error('Upload request timed out. Please check your connection and try again.');
    }
    throw error;
  }

  // Step 2: Upload file using TUS protocol (direct to Livepeer)
  return new Promise((resolve, reject) => {
    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const uploadTimeout = 30 * 60 * 1000; // 30 minutes max for entire upload

    // Set overall upload timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error('Upload timed out after 30 minutes. Please check your connection and try again.'));
    }, uploadTimeout);

    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      uploadSize: file.size,
      chunkSize: 50 * 1024 * 1024, // 50MB chunks for faster upload
      // Improved retry strategy with exponential backoff for better reliability
      retryDelays: [0, 2000, 5000, 10000, 30000], // More retries with longer delays
      parallelUploads: 1, // Sequential for stability
      // CRITICAL: Disable fingerprint storage entirely to prevent 409 conflicts
      // Each upload gets a fresh URL from our backend, so resumability isn't needed
      // and causes stale session conflicts when Livepeer expires the upload
      urlStorage: undefined,
      fingerprint: () => Promise.resolve(undefined as unknown as string), // Also disable fingerprint generation
      removeFingerprintOnSuccess: true, // Clean up after success (belt and suspenders)
      // CRITICAL: Also remove fingerprint on error to prevent 409 conflicts on retry
      onShouldRetry: (err, retryAttempt, options) => {
        const errorMessage = err?.message || String(err);

        // Don't retry on 409 conflicts - clear all fingerprints and fail
        if (errorMessage.includes('409')) {
          console.error('❌ 409 Conflict detected - clearing all TUS fingerprints');
          clearStaleTusFingerprints();
          return false; // Don't retry, let it fail and user can try again fresh
        }

        // Retry on 500 errors but only up to the configured retry attempts
        if (errorMessage.includes('500')) {
          console.warn(`⚠️ 500 Server error - retry attempt ${retryAttempt}`);
          const maxRetries = options?.retryDelays?.length || 5;
          return retryAttempt < maxRetries;
        }

        // Default retry behavior for other errors
        return true;
      },
      onError: (error) => {
        clearTimeout(timeoutId); // Clear timeout on error
        console.error("TUS upload error:", error);

        // Handle specific error codes
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('409')) {
          // Conflict error - upload session already exists, clear fingerprints
          console.error('❌ Upload conflict (409): Stale session detected. Fingerprints cleared.');
          clearStaleTusFingerprints();
          reject(new Error('Upload session expired. Please try uploading again.'));
        } else if (errorMessage.includes('500')) {
          // Server error - likely Livepeer storage issue
          console.error('❌ Server error (500): Livepeer storage issue');
          reject(new Error('Upload failed due to server error. Please try again in a few moments.'));
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          // Network timeout or connection error
          console.error('❌ Network error: Connection timed out or network issue');
          reject(new Error('Network error during upload. Please check your connection and try again.'));
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
        clearTimeout(timeoutId); // Clear timeout on success
        console.log("✅ TUS upload completed successfully");
        resolve(asset);
      },
    });

    // Handle abort signal
    abortController.signal.addEventListener('abort', () => {
      upload.abort(true); // Abort the upload
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
  const maxAttempts = 240; // 20 minutes (5s intervals) - increased for very large videos (up to 5GB)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Add timeout to status fetch to prevent hanging
      const controller = new AbortController();
      const statusTimeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout per request

      const response = await fetch(`/api/upload/status/${assetId}`, {
        signal: controller.signal,
      });

      clearTimeout(statusTimeout);

      if (!response.ok) {
        // Don't fail immediately on status check errors - retry
        console.warn(`Status check failed (attempt ${attempts + 1}/${maxAttempts}):`, response.status);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }

      const asset: LivepeerAsset = await response.json();

      if (onProgress && asset.status.progress) {
        onProgress(asset.status.progress);
      }

      if (asset.status.phase === "ready") {
        console.log("✅ Asset processing completed");
        return asset;
      }

      if (asset.status.phase === "failed") {
        throw new Error("Asset processing failed. The video may be corrupted or in an unsupported format.");
      }

      // Log progress for debugging
      console.log(`Processing... Phase: ${asset.status.phase}, Progress: ${asset.status.progress || 0}%`);

      // Wait 5 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error: any) {
      // Handle timeout errors
      if (error.name === 'AbortError') {
        console.warn(`Status check timed out (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }
      // Re-throw other errors
      throw error;
    }
  }

  throw new Error("Asset processing timeout after 20 minutes. The video may be very large or there may be a processing issue. Please try again or use a smaller file.");
}

/**
 * Get playback URL for an asset
 */
export function getPlaybackUrl(playbackId: string): string {
  return `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${playbackId}/index.m3u8`;
}
