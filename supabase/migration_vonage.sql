-- =====================================================
-- Vonage Dialer Integration Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add outbound caller ID number to projects (lead lists)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vonage_number TEXT;

-- 2. Vonage call tracking table
CREATE TABLE IF NOT EXISTS vonage_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  vonage_uuid TEXT,                    -- Vonage conversation/call UUID
  from_number TEXT,                    -- Caller ID used
  to_number TEXT,                      -- Number dialed
  status TEXT DEFAULT 'initiated',     -- initiated → ringing → answered → completed / failed
  duration INTEGER,                    -- Call duration in seconds
  recording_url TEXT,                  -- Vonage recording download URL
  transcription TEXT,                  -- Full transcription text
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_vonage_calls_contact ON vonage_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_vonage_calls_uuid ON vonage_calls(vonage_uuid);
CREATE INDEX IF NOT EXISTS idx_vonage_calls_created ON vonage_calls(created_at DESC);

-- 4. Row Level Security
ALTER TABLE vonage_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vonage_calls"
  ON vonage_calls FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
