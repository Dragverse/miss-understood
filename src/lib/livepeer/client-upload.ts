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
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleared ${keysToRemove.length} stale TUS fingerprint(s)`);
    }
  } catch (e) {
    console.warn('Failed to clear TUS fingerprints:', e);
  }
}

/**
 * Request a fresh upload URL from our backend (creates a new Livepeer asset)
 */
async function requestUploadUrl(
  fileName: string,
  headers: Record<string, string>
): Promise<{ tusEndpoint: string; asset: LivepeerAsset }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("/api/upload/request", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: fileName }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let errorMessage = "Failed to get upload URL";
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details) errorMessage += `: ${errorData.details}`;
        }
      } catch {
        errorMessage = `Failed to get upload URL (${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { tusEndpoint: data.tusEndpoint, asset: data.asset };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Upload request timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

/**
 * Run a single TUS upload attempt to Livepeer
 */
function runTusUpload(
  file: File,
  tusEndpoint: string,
  asset: LivepeerAsset,
  onProgress?: (progress: UploadProgress) => void
): Promise<LivepeerAsset> {
  return new Promise((resolve, reject) => {
    const uploadTimeout = 30 * 60 * 1000; // 30 minutes max

    const timeoutId = setTimeout(() => {
      upload.abort(true);
      reject(new Error('Upload timed out after 30 minutes.'));
    }, uploadTimeout);

    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      uploadSize: file.size,
      chunkSize: 50 * 1024 * 1024, // 50MB chunks
      retryDelays: [0, 2000, 5000, 10000, 30000],
      parallelUploads: 1,
      // Disable fingerprint storage — each upload gets a fresh URL
      urlStorage: undefined,
      fingerprint: () => Promise.resolve(undefined as unknown as string),
      removeFingerprintOnSuccess: true,
      onShouldRetry: (err) => {
        const msg = err?.message || String(err);
        // Never retry 409 within TUS — we handle it at the outer level
        if (msg.includes('409')) return false;
        return true;
      },
      onError: (error) => {
        clearTimeout(timeoutId);
        reject(error);
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
        clearTimeout(timeoutId);
        console.log("✅ TUS upload completed successfully");
        resolve(asset);
      },
    });

    upload.start();
  });
}

/**
 * Upload video file to Livepeer via backend API.
 * Automatically retries with a fresh upload URL on 409 conflict.
 */
export async function uploadVideoToLivepeer(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  authToken?: string | null
): Promise<LivepeerAsset> {
  clearStaleTusFingerprints();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`📤 Upload attempt ${attempt}/${MAX_ATTEMPTS} for: ${file.name}`);

    const { tusEndpoint, asset } = await requestUploadUrl(file.name, headers);

    try {
      return await runTusUpload(file, tusEndpoint, asset, onProgress);
    } catch (error: any) {
      const msg = error?.message || String(error);

      if (msg.includes('409') && attempt < MAX_ATTEMPTS) {
        // 409 = stale server-side TUS session. Get a fresh URL and retry.
        console.warn(`⚠️ 409 Conflict on attempt ${attempt} — getting fresh upload URL...`);
        clearStaleTusFingerprints();
        continue;
      }

      // Final attempt or non-retryable error
      if (msg.includes('409')) {
        throw new Error('Upload conflict persists. Please wait a minute and try again.');
      } else if (msg.includes('500')) {
        throw new Error('Upload failed due to server error. Please try again in a few moments.');
      } else if (msg.includes('timeout') || msg.includes('network')) {
        throw new Error('Network error during upload. Please check your connection and try again.');
      }
      throw error;
    }
  }

  throw new Error('Upload failed after multiple attempts. Please try again.');
}

/**
 * Poll asset status until ready via backend API
 */
export async function waitForAssetReady(
  assetId: string,
  onProgress?: (progress: number) => void
): Promise<LivepeerAsset> {
  const maxAttempts = 240; // 20 minutes (5s intervals)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const controller = new AbortController();
      const statusTimeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`/api/upload/status/${assetId}`, {
        signal: controller.signal,
      });

      clearTimeout(statusTimeout);

      if (!response.ok) {
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

      console.log(`Processing... Phase: ${asset.status.phase}, Progress: ${asset.status.progress || 0}%`);

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Status check timed out (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }
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
