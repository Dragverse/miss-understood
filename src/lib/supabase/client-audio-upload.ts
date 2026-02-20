/**
 * Client-side audio upload to Supabase Storage via signed URLs.
 * Bypasses Vercel's 4.5MB body limit by uploading directly from browser to Supabase.
 */

export interface AudioUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface SignedUrlResponse {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

/**
 * Upload an audio file directly to Supabase Storage.
 *
 * Flow:
 * 1. Calls our API to get a signed upload URL (lightweight, authenticated)
 * 2. Uploads the file directly to Supabase Storage using XHR (supports progress)
 * 3. Returns the public URL for database storage
 */
export async function uploadAudioToSupabase(
  file: File,
  onProgress?: (progress: AudioUploadProgress) => void,
  authToken?: string | null
): Promise<{ publicUrl: string; path: string }> {
  // Step 1: Get signed upload URL from our API
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  console.log("[AudioUpload] Requesting signed URL for:", file.name);

  const response = await fetch("/api/upload/audio-url", {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName: file.name }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to get upload URL (${response.status})`);
  }

  const { signedUrl, path, publicUrl }: SignedUrlResponse = await response.json();
  console.log("[AudioUpload] Got signed URL, uploading directly to Supabase...");

  // Step 2: Upload file directly to Supabase Storage via XHR (for progress tracking)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log("[AudioUpload] ✅ Upload complete");
        resolve();
      } else {
        console.error("[AudioUpload] Upload failed:", xhr.status, xhr.responseText);
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload. Please check your connection."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out. Please try again."));
    });

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.timeout = 30 * 60 * 1000; // 30 minute timeout for large files
    xhr.send(file);
  });

  return { publicUrl, path };
}
