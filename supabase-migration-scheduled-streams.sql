-- Migration: Add scheduled_at to streams for upcoming livestream announcements
-- Run in Supabase SQL Editor

ALTER TABLE streams ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
