/**
 * Image upload utilities for profile images (banner, avatar)
 * Uses Livepeer's IPFS gateway for decentralized storage
 */

interface ImageUploadOptions {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: ImageUploadOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.9,
};

/**
 * Validate image file type
 */
function validateImageType(file: File): void {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error(
      "Invalid image type. Please upload a JPG, PNG, or WebP image."
    );
  }
}

/**
 * Validate image file size
 */
function validateImageSize(file: File, maxSize: number): void {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    throw new Error(`Image size must be less than ${maxSizeMB}MB`);
  }
}

/**
 * Compress and resize image using canvas
 */
async function compressImage(
  file: File,
  options: ImageUploadOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > (options.maxWidth || DEFAULT_OPTIONS.maxWidth!)) {
          height = (height * (options.maxWidth || DEFAULT_OPTIONS.maxWidth!)) / width;
          width = options.maxWidth || DEFAULT_OPTIONS.maxWidth!;
        }
        if (height > (options.maxHeight || DEFAULT_OPTIONS.maxHeight!)) {
          width = (width * (options.maxHeight || DEFAULT_OPTIONS.maxHeight!)) / height;
          height = options.maxHeight || DEFAULT_OPTIONS.maxHeight!;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          file.type,
          options.quality || DEFAULT_OPTIONS.quality
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload image to Livepeer IPFS
 * Returns IPFS URL
 */
export async function uploadImageToIPFS(
  file: File,
  options: ImageUploadOptions = {},
  authToken?: string
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Validate file
  validateImageType(file);
  validateImageSize(file, mergedOptions.maxSizeBytes!);

  // Compress image
  const compressedBlob = await compressImage(file, mergedOptions);

  // Convert blob to file
  const compressedFile = new File([compressedBlob], file.name, {
    type: file.type,
  });

  // Upload to Livepeer IPFS
  const formData = new FormData();
  formData.append("file", compressedFile);

  try {
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch("/api/upload/image", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      console.error("Image upload failed:", {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });

      let errorMessage = `Failed to upload image (${response.status})`;
      try {
        const error = await response.json();

        // Handle authentication errors
        if (error.errorType === "UNAUTHORIZED" || response.status === 401) {
          errorMessage = "Please log in to upload images";
        } else {
          errorMessage = error.error || error.message || errorMessage;
        }
      } catch (e) {
        // Response might not be JSON
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.ipfsUrl && !data.url) {
      throw new Error("No URL returned from upload");
    }
    return data.ipfsUrl || data.url;
  } catch (error) {
    console.error("Image upload error:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to upload image to IPFS");
  }
}

/**
 * Upload profile banner (1920x480 recommended)
 */
export async function uploadBanner(file: File, authToken?: string): Promise<string> {
  return uploadImageToIPFS(file, {
    maxWidth: 1920,
    maxHeight: 480,
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    quality: 0.9,
  }, authToken);
}

/**
 * Upload profile avatar (400x400 recommended)
 */
export async function uploadAvatar(file: File, authToken?: string): Promise<string> {
  return uploadImageToIPFS(file, {
    maxWidth: 400,
    maxHeight: 400,
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    quality: 0.9,
  }, authToken);
}

/**
 * Get data URL from file for preview
 */
export function getImageDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
