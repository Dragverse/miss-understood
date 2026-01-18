/**
 * Verified Creators Configuration
 *
 * Add Privy user IDs (DIDs) or wallet addresses here to mark creators as verified.
 * Verified creators will display the gold verification badge throughout the platform.
 */

export const VERIFIED_CREATORS = new Set<string>([
  // Privy user IDs (DIDs) - format: "did:privy:..."
  // Example: "did:privy:cm123abc456def",

  // Wallet addresses (will be matched against linked wallets)
  "0x8fFd4850CD2Dc1044bf315D81E1ddBE659Ec4186", // saltï
]);

/**
 * Check if a creator is verified
 */
export function isVerified(did: string): boolean {
  return VERIFIED_CREATORS.has(did);
}

/**
 * Add a creator to the verified list (for admin use)
 */
export function addVerifiedCreator(did: string): void {
  VERIFIED_CREATORS.add(did);
}

/**
 * Remove a creator from the verified list (for admin use)
 */
export function removeVerifiedCreator(did: string): void {
  VERIFIED_CREATORS.delete(did);
}

/**
 * Get all verified creator DIDs
 */
export function getVerifiedCreators(): string[] {
  return Array.from(VERIFIED_CREATORS);
}
