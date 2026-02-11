/**
 * Secure encryption utilities for Farcaster signer private keys
 * Uses AES-256-GCM authenticated encryption
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * IMPORTANT: Set FARCASTER_SIGNER_ENCRYPTION_KEY in .env.local
 */
function getEncryptionKey(): Buffer {
  const key = process.env.FARCASTER_SIGNER_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "FARCASTER_SIGNER_ENCRYPTION_KEY not set. Generate one with: openssl rand -hex 32"
    );
  }

  // Key should be 32 bytes (256 bits) in hex format
  if (key.length !== 64) {
    throw new Error(
      "FARCASTER_SIGNER_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypt a private key for secure storage
 * Returns: base64-encoded string in format: iv:authTag:encryptedData
 */
export function encryptPrivateKey(privateKeyHex: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(privateKeyHex, "hex", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    const combined = `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;

    return combined;
  } catch (error) {
    console.error("[Encryption] Failed to encrypt private key:", error);
    throw new Error("Failed to encrypt signer key");
  }
}

/**
 * Decrypt a private key for signing operations
 * Input: base64-encoded string in format: iv:authTag:encryptedData
 * Returns: private key as hex string
 */
export function decryptPrivateKey(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Split IV + authTag + encrypted data
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("hex");
  } catch (error) {
    console.error("[Decryption] Failed to decrypt private key:", error);
    throw new Error("Failed to decrypt signer key");
  }
}

/**
 * Generate a secure random encryption key
 * Use this to generate FARCASTER_SIGNER_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
