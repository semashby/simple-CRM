-- =====================================================
-- Migration: Add Cal.com support
-- Run this in the Supabase SQL Editor
-- Adds fields to store Cal.com platform users
-- =====================================================

ALTER TABLE calendar_connections
  ADD COLUMN IF NOT EXISTS cal_user_id TEXT,
  ADD COLUMN IF NOT EXISTS cal_access_token TEXT,
  ADD COLUMN IF NOT EXISTS cal_refresh_token TEXT;
