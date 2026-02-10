/**
 * Security tests for Comment API
 * Tests authentication requirements to prevent author spoofing
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/social/comment/route';

// Mock the auth module
jest.mock('@/lib/auth/verify', () => ({
  verifyAuth: jest.fn(),
  isPrivyConfigured: jest.fn(() => true),
}));

// Mock the social module
jest.mock('@/lib/supabase/social', () => ({
  createComment: jest.fn(),
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
import { createComment } from '@/lib/supabase/social';

describe('Comment API Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/social/comment', () => {
    it('should reject unauthenticated requests', async () => {
      // Mock unauthenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          content: 'Test comment',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required to comment');
      expect(createComment).not.toHaveBeenCalled();
    });

    it('should always require authentication (fail-closed)', async () => {
      // Even if Privy is not configured, should still require auth
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          authorDID: 'did:privy:spoofed-user', // Attacker tries to spoof
          content: 'Malicious comment',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // CRITICAL: Should reject even with authorDID provided
      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required to comment');
      expect(createComment).not.toHaveBeenCalled();
    });

    it('should accept authenticated requests and use auth userId', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      const mockComment = {
        id: 'comment-123',
        video_id: 'test-video-id',
        author_did: authenticatedUserId,
        content: 'Test comment',
        created_at: new Date().toISOString(),
      };

      (createComment as jest.Mock).mockResolvedValue(mockComment);

      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          content: 'Test comment',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.comment).toEqual(mockComment);

      // CRITICAL: Verify createComment was called with authenticated user's DID
      expect(createComment).toHaveBeenCalledWith({
        videoId: 'test-video-id',
        authorDID: authenticatedUserId,
        content: 'Test comment',
        parentCommentId: undefined,
      });
    });

    it('should not allow author spoofing via client-provided authorDID', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const spoofedUserId = 'did:privy:victim-user';

      // Mock authenticated user
      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      const mockComment = {
        id: 'comment-123',
        video_id: 'test-video-id',
        author_did: authenticatedUserId,
        content: 'Test comment',
        created_at: new Date().toISOString(),
      };

      (createComment as jest.Mock).mockResolvedValue(mockComment);

      // Attacker tries to send spoofed authorDID
      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          authorDID: spoofedUserId, // Attempting to spoof
          content: 'Malicious comment pretending to be victim',
        }),
      });

      const response = await POST(request);

      // CRITICAL: Verify createComment uses authenticated DID, not spoofed DID
      expect(createComment).toHaveBeenCalledWith({
        videoId: 'test-video-id',
        authorDID: authenticatedUserId, // Should use authenticated user
        content: 'Malicious comment pretending to be victim',
        parentCommentId: undefined,
      });
      expect(createComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          authorDID: spoofedUserId,
        })
      );
    });

    it('should handle reply comments with authentication', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';
      const parentCommentId = 'parent-comment-123';

      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      const mockComment = {
        id: 'reply-comment-456',
        video_id: 'test-video-id',
        author_did: authenticatedUserId,
        content: 'Test reply',
        parent_comment_id: parentCommentId,
        created_at: new Date().toISOString(),
      };

      (createComment as jest.Mock).mockResolvedValue(mockComment);

      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          content: 'Test reply',
          parentCommentId,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(createComment).toHaveBeenCalledWith({
        videoId: 'test-video-id',
        authorDID: authenticatedUserId,
        content: 'Test reply',
        parentCommentId,
      });
    });

    it('should reject requests with missing required fields', async () => {
      const authenticatedUserId = 'did:privy:authenticated-user';

      (verifyAuth as jest.Mock).mockResolvedValue({
        authenticated: true,
        userId: authenticatedUserId,
      });

      // Missing content
      const request = new NextRequest('http://localhost:3000/api/social/comment', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test-video-id',
          // content missing
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
      expect(createComment).not.toHaveBeenCalled();
    });
  });
});
