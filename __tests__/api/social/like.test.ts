/**
 * Security tests for Like API
 * Tests authentication requirements to prevent user spoofing
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST, GET } from '@/app/api/social/like/route';

// Mock the auth module
jest.mock('@/lib/auth/verify', () => ({
  verifyAuth: jest.fn(),
}));

// Mock the social module
jest.mock('@/lib/supabase/social', () => ({
  likeVideo: jest.fn(),
  unlikeVideo: jest.fn(),
  hasLikedVideo: jest.fn(),
}));

// Mock other dependencies
jest.mock('@/lib/supabase/videos', () => ({
  getVideo: jest.fn(),
}));

jest.mock('@/lib/supabase/creators', () => ({
  getCreatorByDID: jest.fn(),
}));

jest.mock('@/lib/supabase/notifications', () => ({
  createNotification: jest.fn(),
}));

import { verifyAuth } from '@/lib/auth/verify';
import { likeVideo, unlikeVideo, hasLikedVideo } from '@/lib/supabase/social';

describe('Like API Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/social/like', () => {
    it('should reject unauthenticated requests', async () => {
      // Mock unauthenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const request = new NextRequest('http://localhost:3000/api/social/like', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          action: 'like',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(likeVideo).not.toHaveBeenCalled();
    });

    it('should accept authenticated requests and use auth userId', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (likeVideo as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/social/like', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          action: 'like',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.liked).toBe(true);

      // CRITICAL: Verify likeVideo was called with authenticated user's DID, not client-provided
      expect(likeVideo).toHaveBeenCalledWith(authenticatedUserId, 'test-video-id');
    });

    it('should not allow user spoofing via client-provided userDID', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const spoofedUserId = 'did:privy:victim-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (likeVideo as jest.Mock).mockResolvedValue(undefined);

      // Attacker tries to send spoofed userDID
      const request = new NextRequest('http://localhost:3000/api/social/like', {
        method: 'POST',
        body: JSON.stringify({
          userDID: spoofedUserId, // Attempting to spoof
          videoId: 'test-video-id',
          action: 'like',
        }),
      });

      const response = await POST(request);

      // CRITICAL: Verify likeVideo uses authenticated DID, not spoofed DID
      expect(likeVideo).toHaveBeenCalledWith(
        authenticatedUserId, // Should use authenticated user
        'test-video-id'
      );
      expect(likeVideo).not.toHaveBeenCalledWith(spoofedUserId, 'test-video-id');
    });

    it('should handle unlike action with authentication', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (unlikeVideo as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/social/like', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          action: 'unlike',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.liked).toBe(false);
      expect(unlikeVideo).toHaveBeenCalledWith(authenticatedUserId, 'test-video-id');
    });
  });

  describe('GET /api/social/like', () => {
    it('should reject unauthenticated requests to check endpoint', async () => {
      // Mock unauthenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const url = new URL('http://localhost:3000/api/social/like');
      url.searchParams.set('videoId', 'test-video-id');

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(hasLikedVideo).not.toHaveBeenCalled();
    });

    it('should only allow checking current user\'s likes', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (hasLikedVideo as jest.Mock).mockResolvedValue(true);

      const url = new URL('http://localhost:3000/api/social/like');
      url.searchParams.set('videoId', 'test-video-id');

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.liked).toBe(true);

      // CRITICAL: Verify hasLikedVideo uses authenticated user's DID
      expect(hasLikedVideo).toHaveBeenCalledWith(authenticatedUserId, 'test-video-id');
    });

    it('should not allow checking other users\' likes', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const targetUserId = 'did:privy:target-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (hasLikedVideo as jest.Mock).mockResolvedValue(false);

      // Attacker tries to check another user's likes
      const url = new URL('http://localhost:3000/api/social/like');
      url.searchParams.set('userDID', targetUserId); // Attempting to check another user
      url.searchParams.set('videoId', 'test-video-id');

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);

      // CRITICAL: Should check authenticated user's likes, not target user
      expect(hasLikedVideo).toHaveBeenCalledWith(authenticatedUserId, 'test-video-id');
      expect(hasLikedVideo).not.toHaveBeenCalledWith(targetUserId, 'test-video-id');
    });
  });
});
