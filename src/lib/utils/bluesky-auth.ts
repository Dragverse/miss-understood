import { Creator } from "@/types";

/**
 * Check if user has connected their Bluesky account
 */
export function isBlueskyConnected(creator: Partial<Creator> | null): boolean {
  return !!(creator?.blueskyHandle && creator?.blueskyAppPassword);
}

/**
 * Encrypt app password using Web Crypto API
 * Key is derived from a fixed salt (in production, use user session-specific key)
 */
export async function encryptPassword(password: string): Promise<string> {
  if (typeof window === "undefined") {
    // Server-side: just base64 encode (not truly secure, but prevents plain text)
    return btoa(password);
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    // Generate a key from a passphrase (in production, use user-specific key)
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("dragverse-encryption-key"), // Should be user-specific
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("dragverse-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // Encrypt the password
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption failed:", error);
    // Fallback to base64
    return btoa(password);
  }
}

/**
 * Decrypt app password
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  if (typeof window === "undefined") {
    // Server-side: just base64 decode
    return atob(encrypted);
  }

  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Generate the same key
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("dragverse-encryption-key"),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("dragverse-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    // Fallback to base64 decode
    return atob(encrypted);
  }
}

/**
 * Clear Bluesky credentials (on logout)
 */
export function clearBlueskyCredentials(): void {
  if (typeof window === "undefined") return;

  try {
    const profile = localStorage.getItem("dragverse_profile");
    if (profile) {
      const parsed = JSON.parse(profile);
      delete parsed.blueskyHandle;
      delete parsed.blueskyAppPassword;
      localStorage.setItem("dragverse_profile", JSON.stringify(parsed));
    }
  } catch (error) {
    console.error("Failed to clear Bluesky credentials:", error);
  }
}
