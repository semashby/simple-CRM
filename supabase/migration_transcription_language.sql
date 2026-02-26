-- Migration: Add transcription_language to projects
-- Run this in Supabase SQL Editor

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS transcription_language TEXT DEFAULT 'nl-NL';

-- Update any existing projects to Dutch as default
UPDATE projects SET transcription_language = 'nl-NL' WHERE transcription_language IS NULL;
