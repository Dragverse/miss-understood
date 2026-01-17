/**
 * Environment Configuration
 * Determines whether to use mock data based on environment
 */

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Feature flags
export const USE_MOCK_DATA = isDevelopment || process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
export const USE_CERAMIC = isProduction || process.env.NEXT_PUBLIC_USE_CERAMIC === 'true';

// Environment info
export const config = {
  env: process.env.NODE_ENV,
  useMockData: USE_MOCK_DATA,
  useCeramic: USE_CERAMIC,
  isDevelopment,
  isProduction,
} as const;
