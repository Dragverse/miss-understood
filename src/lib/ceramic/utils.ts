import { getComposeClient } from './client';

/**
 * Check if Ceramic/ComposeDB is properly initialized
 */
export function isCeramicInitialized(): boolean {
  const compose = getComposeClient();
  return compose !== null;
}

/**
 * Throw error if Ceramic is not initialized
 */
export function throwIfNotInitialized(): void {
  if (!isCeramicInitialized()) {
    throw new Error('Ceramic is not initialized. Run: npm run ceramic:setup');
  }
}

/**
 * Execute Ceramic operation with fallback
 * Returns fallback value if Ceramic is unavailable or operation fails
 */
export async function withCeramicFallback<T>(
  ceramicOperation: () => Promise<T>,
  fallbackValue: T,
  errorMessage?: string
): Promise<T> {
  try {
    if (!isCeramicInitialized()) {
      console.warn('Ceramic not initialized, using fallback');
      return fallbackValue;
    }
    return await ceramicOperation();
  } catch (error) {
    console.error(errorMessage || 'Ceramic operation failed:', error);
    return fallbackValue;
  }
}
