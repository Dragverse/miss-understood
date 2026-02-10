/**
 * Security tests for Follow API
 * Tests authentication requirements and self-follow prevention
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/social/follow/route';

// Mock the auth module
jest.mock('@/lib/auth/verify', () => ({
  verifyAuth: jest.fn(),
}));

// Mock the social module
jest.mock('@/lib/supabase/social', () => ({
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  isFollowing: jest.fn(),
}));

// Mock other dependencies
jest.mock('@/lib/supabase/creators', () => ({
  getCreatorByDID: jest.fn(),
}));

jest.mock('@/lib/supabase/notifications', () => ({
  createNotification: jest.fn(),
}));

import { verifyAuth } from '@/lib/auth/verify';
import { followUser, unfollowUser, isFollowing } from '@/lib/supabase/social';

describe('Follow API Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/social/follow', () => {
    it('should reject unauthenticated requests', async () => {
      // Mock unauthenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const request = new NextRequest('http://localhost:3000/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({
          followingDID: 'did:privy:target-user',
          action: 'follow',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(followUser).not.toHaveBeenCalled();
    });

    it('should accept authenticated requests and use auth userId', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const targetUserId = 'did:privy:target-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (followUser as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({
          followingDID: targetUserId,
          action: 'follow',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.following).toBe(true);

      // CRITICAL: Verify followUser was called with authenticated user's DID as follower
      expect(followUser).toHaveBeenCalledWith(authenticatedUserId, targetUserId);
    });

    it('should not allow user spoofing via client-provided followerDID', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const spoofedUserId = 'did:privy:victim-user';
      const targetUserId = 'did:privy:target-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (followUser as jest.Mock).mockResolvedValue(undefined);

      // Attacker tries to send spoofed followerDID
      const request = new NextRequest('http://localhost:3000/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({
          followerDID: spoofedUserId, // Attempting to spoof
          followingDID: targetUserId,
          action: 'follow',
        }),
      });

      const response = await POST(request);

      // CRITICAL: Verify followUser uses authenticated DID, not spoofed DID
      expect(followUser).toHaveBeenCalledWith(
        authenticatedUserId, // Should use authenticated user
        targetUserId
      );
      expect(followUser).not.toHaveBeenCalledWith(spoofedUserId, targetUserId);
    });

    it('should prevent self-follow', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      // User tries to follow themselves
      const request = new NextRequest('http://localhost:3000/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({
          followingDID: authenticatedUserId, // Same as authenticated user
          action: 'follow',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot follow yourself');
      expect(followUser).not.toHaveBeenCalled();
    });

    it('should handle unfollow action with authentication', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const targetUserId = 'did:privy:target-user';

      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (unfollowUser as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({
          followingDID: targetUserId,
          action: 'unfollow',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.following).toBe(false);
      expect(unfollowUser).toHaveBeenCalledWith(authenticatedUserId, targetUserId);
    });
  });

  describe('GET /api/social/follow', () => {
    it('should reject unauthenticated requests to check endpoint', async () => {
      // Mock unauthenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const url = new URL('http://localhost:3000/api/social/follow');
      url.searchParams.set('followingDID', 'did:privy:target-user');

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(isFollowing).not.toHaveBeenCalled();
    });

    it('should only allow checking current user\'s follows', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const targetUserId = 'did:privy:target-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (isFollowing as jest.Mock).mockResolvedValue(true);

      const url = new URL('http://localhost:3000/api/social/follow');
      url.searchParams.set('followingDID', targetUserId);

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.following).toBe(true);

      // CRITICAL: Verify isFollowing uses authenticated user's DID as follower
      expect(isFollowing).toHaveBeenCalledWith(authenticatedUserId, targetUserId);
    });

    it('should not allow checking other users\' follows', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const otherUserId = 'did:privy:other-user';
      const targetUserId = 'did:privy:target-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      (isFollowing as jest.Mock).mockResolvedValue(false);

      // Attacker tries to check another user's follows
      const url = new URL('http://localhost:3000/api/social/follow');
      url.searchParams.set('followerDID', otherUserId); // Attempting to check another user
      url.searchParams.set('followingDID', targetUserId);

      const request = new NextRequest(url, {
        method: 'GET',
      });

      const response = await GET(request);

      // CRITICAL: Should check authenticated user's follows, not other user
      expect(isFollowing).toHaveBeenCalledWith(authenticatedUserId, targetUserId);
      expect(isFollowing).not.toHaveBeenCalledWith(otherUserId, targetUserId);
    });
  });
});
