-- ============================================
-- Migration: Premiere / Scheduled Content
-- Date: 2026-02-14
-- Purpose: Add premiere_mode column to videos and posts tables
-- ============================================
--
-- Run this in Supabase Dashboard > SQL Editor
--
-- Publishing logic:
-- - Content is "published" when published_at IS NULL (immediate) or published_at <= NOW()
-- - Content is "scheduled" when published_at IS NOT NULL AND published_at > NOW()
-- - premiere_mode = 'countdown' → public landing page with countdown timer
-- - premiere_mode = 'silent' → hidden until published_at, then appears in feed
-- - The cron job clears premiere_mode to NULL after publishing
-- ============================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS premiere_mode TEXT CHECK (premiere_mode IN ('countdown', 'silent'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS premiere_mode TEXT CHECK (premiere_mode IN ('countdown', 'silent'));
